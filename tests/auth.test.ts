import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	attemptUnlock,
	createSession,
	deleteSession,
	IP_MAX_FAILURES,
	IP_WINDOW_MS,
	SESSION_TTL_MS,
	SPACE_MAX_FAILURES,
	validateSession
} from '$lib/server/auth';
import type { Db } from '$lib/server/db/client';
import { hashPassword } from '$lib/server/password';
import { createTestDb, PASSWORDS, seedSpaces } from './helpers';

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
});
afterEach(() => cleanup());

const NOW = Date.UTC(2026, 9, 23, 12);

async function fail(times: number, ip: (i: number) => string, now = NOW) {
	for (let i = 0; i < times; i++) await attemptUnlock(db, 'pro', 'mauvais', ip(i), now);
}

describe('mots de passe', () => {
	it('hache en argon2id', async () => {
		expect(await hashPassword('un mot de passe')).toMatch(/^\$argon2id\$/);
	});
});

describe('attemptUnlock', () => {
	it('crée une session pour le bon mot de passe, valable uniquement pour cet espace', async () => {
		const result = await attemptUnlock(db, 'pro', PASSWORDS.pro, '1.1.1.1', NOW);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(await validateSession(db, 'pro', result.token, NOW)).toBe('valid');
		expect(await validateSession(db, 'perso', result.token, NOW)).toBe('invalid');
	});

	it("refuse le mot de passe de l'autre espace", async () => {
		expect(await attemptUnlock(db, 'pro', PASSWORDS.perso, '1.1.1.1', NOW)).toEqual({
			ok: false,
			reason: 'invalid'
		});
	});

	it(`bloque une IP après ${IP_MAX_FAILURES} échecs, même avec le bon mot de passe`, async () => {
		await fail(IP_MAX_FAILURES, () => '1.1.1.1');
		expect(await attemptUnlock(db, 'pro', PASSWORDS.pro, '1.1.1.1', NOW)).toEqual({
			ok: false,
			reason: 'rate_limited'
		});
		// Une autre IP et l'autre espace ne sont pas concernés.
		expect((await attemptUnlock(db, 'pro', PASSWORDS.pro, '2.2.2.2', NOW)).ok).toBe(true);
		expect((await attemptUnlock(db, 'perso', PASSWORDS.perso, '1.1.1.1', NOW)).ok).toBe(true);
	});

	it('débloque une IP une fois la fenêtre écoulée', async () => {
		await fail(IP_MAX_FAILURES, () => '1.1.1.1');
		const later = NOW + IP_WINDOW_MS + 1;
		expect((await attemptUnlock(db, 'pro', PASSWORDS.pro, '1.1.1.1', later)).ok).toBe(true);
	});

	it(`bloque l'espace après ${SPACE_MAX_FAILURES} échecs répartis sur plusieurs IP`, async () => {
		await fail(SPACE_MAX_FAILURES, (i) => `10.0.0.${i}`);
		expect(await attemptUnlock(db, 'pro', PASSWORDS.pro, '9.9.9.9', NOW)).toEqual({
			ok: false,
			reason: 'rate_limited'
		});
		expect((await attemptUnlock(db, 'perso', PASSWORDS.perso, '9.9.9.9', NOW)).ok).toBe(true);
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
