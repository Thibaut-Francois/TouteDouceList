import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	attemptUnlock,
	createSession,
	dailyCode,
	deleteSession,
	IP_MAX_FAILURES,
	IP_WINDOW_MS,
	SESSION_TTL_MS,
	SPACE_MAX_FAILURES,
	validateSession
} from '$lib/server/auth';
import type { Db } from '$lib/server/db/client';
import { createTestDb, seedSpaces } from './helpers';

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
});
afterEach(() => cleanup());

// Vendredi 23 octobre 2026, 14 h à Paris : le code du jour est 1023.
const NOW = Date.UTC(2026, 9, 23, 12);

async function fail(times: number, ip: (i: number) => string, now = NOW) {
	for (let i = 0; i < times; i++) await attemptUnlock(db, 'perso', '0000', ip(i), now);
}

describe('dailyCode', () => {
	it.each([
		['2026-10-23T12:00:00Z', '1023'],
		['2026-01-05T12:00:00Z', '0105'],
		['2026-12-31T12:00:00Z', '1231'],
		['2028-02-29T12:00:00Z', '0229'],
		// Minuit à Paris, pas en UTC : 22 h 30 UTC le 23 = 0 h 30 le 24 (heure d'été).
		['2026-10-23T22:30:00Z', '1024'],
		// Nuit du passage à l'heure d'hiver : 23 h 30 UTC le 25 = 0 h 30 le 26.
		['2026-10-25T22:30:00Z', '1025'],
		['2026-10-25T23:30:00Z', '1026']
	])('%s → %s', (instant, code) => {
		expect(dailyCode(Date.parse(instant))).toBe(code);
	});
});

describe('attemptUnlock', () => {
	it('crée une session Perso avec le code du jour', async () => {
		const result = await attemptUnlock(db, 'perso', '1023', '1.1.1.1', NOW);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(await validateSession(db, 'perso', result.token, NOW)).toBe('valid');
	});

	it('tolère les espaces autour du code', async () => {
		expect((await attemptUnlock(db, 'perso', ' 1023 ', '1.1.1.1', NOW)).ok).toBe(true);
	});

	it.each([
		['1022', 'la veille'],
		['1024', 'le lendemain'],
		['2310', 'jour et mois dans l’autre ordre'],
		['102', 'trop court'],
		['10230', 'trop long'],
		['', 'vide']
	])('refuse %s (%s)', async (code) => {
		expect(await attemptUnlock(db, 'perso', code, '1.1.1.1', NOW)).toEqual({ ok: false, reason: 'invalid' });
	});

	it("n'ouvre jamais de session pour Pro, qui n'en a pas besoin", async () => {
		expect((await attemptUnlock(db, 'pro', '1023', '1.1.1.1', NOW)).ok).toBe(false);
	});

	it(`bloque une IP après ${IP_MAX_FAILURES} échecs, même avec le bon code`, async () => {
		await fail(IP_MAX_FAILURES, () => '1.1.1.1');
		expect(await attemptUnlock(db, 'perso', '1023', '1.1.1.1', NOW)).toEqual({
			ok: false,
			reason: 'rate_limited'
		});
		// Une autre IP n'est pas concernée.
		expect((await attemptUnlock(db, 'perso', '1023', '2.2.2.2', NOW)).ok).toBe(true);
	});

	it('débloque une IP une fois la fenêtre écoulée', async () => {
		await fail(IP_MAX_FAILURES, () => '1.1.1.1');
		const later = NOW + IP_WINDOW_MS + 1;
		expect((await attemptUnlock(db, 'perso', '1023', '1.1.1.1', later)).ok).toBe(true);
	});

	it(`bloque l'espace après ${SPACE_MAX_FAILURES} échecs répartis sur plusieurs IP`, async () => {
		await fail(SPACE_MAX_FAILURES, (i) => `10.0.0.${i}`);
		expect(await attemptUnlock(db, 'perso', '1023', '9.9.9.9', NOW)).toEqual({
			ok: false,
			reason: 'rate_limited'
		});
	});
});

describe('sessions', () => {
	it('expire après la durée de vie', async () => {
		const token = await createSession(db, 'perso', NOW);
		expect(await validateSession(db, 'perso', token, NOW + SESSION_TTL_MS + 1)).toBe('invalid');
	});

	it("se prolonge à l'usage", async () => {
		const token = await createSession(db, 'perso', NOW);
		const later = NOW + SESSION_TTL_MS - 1000;
		expect(await validateSession(db, 'perso', token, later)).toBe('renewed');
		expect(await validateSession(db, 'perso', token, later + SESSION_TTL_MS - 1000)).toBe('renewed');
	});

	it('est invalidée par le verrouillage', async () => {
		const token = await createSession(db, 'perso', NOW);
		await deleteSession(db, token);
		expect(await validateSession(db, 'perso', token, NOW)).toBe('invalid');
	});

	it('refuse un jeton inconnu', async () => {
		expect(await validateSession(db, 'perso', 'inconnu', NOW)).toBe('invalid');
	});
});
