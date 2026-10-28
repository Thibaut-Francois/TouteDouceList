import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireScope } from '$lib/server/auth';
import type { Db } from '$lib/server/db/client';
import { generateDueOccurrences } from '$lib/server/recurrence/generate';
import { createRecurrence } from '$lib/server/repo/recurrences';
import { listOpenTasks } from '$lib/server/repo/tasks';
import * as root from '../src/routes/+page.server';
import * as legacyPro from '../src/routes/pro/[...rest]/+page.server';
import * as appLayout from '../src/routes/[profile=profile]/(app)/+layout.server';
import { createTestDb, fakeEvent, PHILIPPE, seedSpaces, statusOf, THIBAUT } from './helpers';

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
});
afterEach(() => cleanup());

/** Adresse de redirection d'un load (redirect() lève une exception). */
async function redirectOf(run: () => unknown) {
	try {
		await run();
	} catch (e) {
		return (e as { location?: string }).location;
	}
	return undefined;
}

describe('requireScope', () => {
	it('donne le profil et son espace ; Pro sans code', async () => {
		expect(await requireScope(fakeEvent({ db, params: {} }), 'philippe')).toEqual(PHILIPPE);
	});

	it('refuse un profil inconnu, y compris un nom d’espace (404)', async () => {
		for (const profile of ['pro', 'inconnu']) {
			expect(await statusOf(requireScope(fakeEvent({ db, params: {} }), profile) as never)).toBe(404);
		}
	});

	it('Perso sans session : 401, ou le déverrouillage pour une page', async () => {
		expect(await statusOf(requireScope(fakeEvent({ db, params: {} }), 'perso') as never)).toBe(401);
		const event = fakeEvent({ db, params: {} });
		expect(await redirectOf(() => requireScope(event, 'perso', { onLocked: 'redirect' }))).toBe('/perso/unlock');
	});
});

describe('dernier profil Pro', () => {
	const open = (cookies: Record<string, string>, path = '/') =>
		fakeEvent({ db, params: {}, cookies, url: `http://localhost${path}` });

	it('le lancement ouvre le dernier profil Pro, Thibaut par défaut', async () => {
		expect(await redirectOf(() => root.load(open({}) as never))).toBe('/thibaut');
		expect(await redirectOf(() => root.load(open({ tdl_profile: 'philippe' }) as never))).toBe('/philippe');
		// Jamais Perso, ni une valeur inconnue.
		expect(await redirectOf(() => root.load(open({ tdl_profile: 'perso' }) as never))).toBe('/thibaut');
		expect(await redirectOf(() => root.load(open({ tdl_profile: 'x' }) as never))).toBe('/thibaut');
	});

	it('les anciennes adresses /pro mènent à la même page du dernier profil', async () => {
		const event = { ...open({ tdl_profile: 'philippe' }, '/pro/archive?q=devis'), params: { rest: 'archive' } };
		expect(await redirectOf(() => legacyPro.load(event as never))).toBe('/philippe/archive?q=devis');
		const home = { ...open({}, '/pro'), params: { rest: '' } };
		expect(await redirectOf(() => legacyPro.load(home as never))).toBe('/thibaut');
	});

	it('ouvrir un profil Pro le mémorise ; Perso ne remplace jamais le dernier profil Pro', async () => {
		const event = fakeEvent({ db, params: { profile: 'philippe' } });
		await appLayout.load(event as never);
		expect(event.cookies.get('tdl_profile')).toBe('philippe');

		const perso = fakeEvent({ db, params: { profile: 'perso' }, cookies: { tdl_profile: 'philippe' } });
		await statusOf(appLayout.load(perso as never) as never);
		expect(perso.cookies.get('tdl_profile')).toBe('philippe');
	});
});

it('les occurrences d’une récurrence appartiennent à son profil', async () => {
	await createRecurrence(db, PHILIPPE, {
		title: 'Relevé',
		notes: '',
		priority: 3,
		preset: { kind: 'daily' },
		startDate: '2026-10-20'
	});
	expect(await generateDueOccurrences(db, THIBAUT, '2026-10-22')).toBe(0);
	expect(await generateDueOccurrences(db, PHILIPPE, '2026-10-22')).toBe(3);
	expect(await listOpenTasks(db, THIBAUT)).toEqual([]);
	expect((await listOpenTasks(db, PHILIPPE)).map((t) => t.profileId)).toEqual(['philippe', 'philippe', 'philippe']);
});
