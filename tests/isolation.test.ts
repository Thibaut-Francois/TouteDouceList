import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieName, createSession, SESSION_TTL_MS } from '$lib/server/auth';
import type { Db } from '$lib/server/db/client';
import { generateDueOccurrences } from '$lib/server/recurrence/generate';
import { getRecurrence } from '$lib/server/repo/recurrences';
import { getTask } from '$lib/server/repo/tasks';
import type { SpaceId } from '$lib/spaces';
import * as archive from '../src/routes/api/[space=space]/archive/+server';
import * as recurrenceById from '../src/routes/api/[space=space]/recurrences/[id]/+server';
import * as recurrencePreview from '../src/routes/api/[space=space]/recurrences/preview/+server';
import * as recurrenceList from '../src/routes/api/[space=space]/recurrences/+server';
import * as taskById from '../src/routes/api/[space=space]/tasks/[id]/+server';
import * as taskList from '../src/routes/api/[space=space]/tasks/+server';
import { createTestDb, fakeEvent, seedSpaces, statusOf } from './helpers';

// Modèle d'accès : Pro est en accès libre ; Perso exige une session (code du jour).
// Un visiteur sans session peut donc utiliser l'API Pro : elle ne doit jamais atteindre une donnée Perso.

type Caller = 'visitor' | 'perso';

let db: Db;
let cleanup: () => void;
let persoToken: string;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
	persoToken = await createSession(db, 'perso');
});
afterEach(() => cleanup());

type Handler = (event: never) => Response | Promise<Response>;

function call(
	handler: Handler,
	{ as, space, id, method, body }: { as: Caller; space: SpaceId; id?: string; method?: string; body?: unknown }
) {
	const event = fakeEvent({
		db,
		params: id ? { space, id } : { space },
		cookies: as === 'perso' ? { [cookieName('perso')]: persoToken } : {},
		method,
		body
	});
	return handler(event as never);
}

/** Qui a le droit d'écrire dans chaque espace : n'importe qui pour Pro, la session Perso pour Perso. */
const writer = (space: SpaceId): Caller => (space === 'perso' ? 'perso' : 'visitor');

async function createTaskIn(space: SpaceId, title: string) {
	const id = crypto.randomUUID();
	const status = await statusOf(call(taskList.POST, { as: writer(space), space, method: 'POST', body: { id, title } }));
	expect(status).toBe(201);
	return id;
}

describe('accès', () => {
	it('un visiteur sans code utilise Pro librement', async () => {
		const id = await createTaskIn('pro', 'Rapport');
		const opts = { as: 'visitor', space: 'pro', id } as const;
		expect(await statusOf(call(taskList.GET, { as: 'visitor', space: 'pro' }))).toBe(200);
		expect(await statusOf(call(taskById.PATCH, { ...opts, method: 'PATCH', body: { status: 'done' } }))).toBe(200);
		expect(await statusOf(call(archive.GET, { as: 'visitor', space: 'pro' }))).toBe(200);
		expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(204);
	});

	it('un visiteur sans code est refusé partout dans Perso (401)', async () => {
		const id = await createTaskIn('perso', 'Secret');
		const recurrence = await (
			await call(recurrenceList.POST, {
				as: 'perso',
				space: 'perso',
				method: 'POST',
				body: { title: 'Routine', preset: { kind: 'daily' }, startDate: '2026-10-20' }
			})
		).json();
		const opts = { as: 'visitor', space: 'perso' } as const;
		const attempts: [Handler, Parameters<typeof call>[1]][] = [
			[taskList.GET, opts],
			[taskList.POST, { ...opts, method: 'POST', body: { id: crypto.randomUUID(), title: 'x' } }],
			[taskById.GET, { ...opts, id }],
			[taskById.PATCH, { ...opts, id, method: 'PATCH', body: { title: 'piraté' } }],
			[taskById.DELETE, { ...opts, id, method: 'DELETE' }],
			[archive.GET, opts],
			[recurrenceList.GET, opts],
			[recurrenceList.POST, { ...opts, method: 'POST', body: { title: 'x', preset: { kind: 'daily' }, startDate: '2026-10-20' } }],
			[recurrenceById.GET, { ...opts, id: recurrence.id }],
			[recurrenceById.PATCH, { ...opts, id: recurrence.id, method: 'PATCH', body: { active: false } }],
			[recurrenceById.DELETE, { ...opts, id: recurrence.id, method: 'DELETE' }],
			[recurrencePreview.POST, { ...opts, method: 'POST', body: { preset: { kind: 'daily' }, startDate: '2026-10-20' } }]
		];
		for (const [handler, args] of attempts) expect(await statusOf(call(handler, args))).toBe(401);

		expect(await getTask(db, 'perso', id)).toMatchObject({ title: 'Secret', status: 'open' });
		expect(await getRecurrence(db, 'perso', recurrence.id)).toMatchObject({ active: true });
	});

	it('refuse un jeton Perso inconnu, supprimé ou expiré', async () => {
		const forged = fakeEvent({ db, params: { space: 'perso' }, cookies: { [cookieName('perso')]: 'invente' } });
		expect(await statusOf(taskList.GET(forged as never))).toBe(401);

		const old = await createSession(db, 'perso', Date.now() - SESSION_TTL_MS - 1000);
		const expired = fakeEvent({ db, params: { space: 'perso' }, cookies: { [cookieName('perso')]: old } });
		expect(await statusOf(taskList.GET(expired as never))).toBe(401);
	});

	it('une session Perso ouvre Perso', async () => {
		await createTaskIn('perso', 'Mienne');
		const res = await call(taskList.GET, { as: 'perso', space: 'perso' });
		expect(await res.json()).toHaveLength(1);
	});
});

// Étanchéité des données : une ressource n'est jamais atteignable via l'API de l'autre espace.
describe.each([
	{ owner: 'perso', via: 'pro', as: 'visitor' },
	{ owner: 'pro', via: 'perso', as: 'perso' }
] satisfies { owner: SpaceId; via: SpaceId; as: Caller }[])(
	'une tâche $owner, via l’API $via',
	({ owner, via, as }) => {
		let id: string;
		beforeEach(async () => {
			id = await createTaskIn(owner, `Secret ${owner}`);
		});

		it('est introuvable : ni lecture, ni modification, ni suppression (404)', async () => {
			const opts = { as, space: via, id };
			expect(await statusOf(call(taskById.GET, opts))).toBe(404);
			expect(
				await statusOf(call(taskById.PATCH, { ...opts, method: 'PATCH', body: { title: 'piraté', status: 'done' } }))
			).toBe(404);
			expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(404);
			expect(await getTask(db, owner, id)).toMatchObject({ title: `Secret ${owner}`, status: 'open' });
		});

		it('n’apparaît ni dans la liste ni dans l’archive', async () => {
			await call(taskById.PATCH, { as: writer(owner), space: owner, id, method: 'PATCH', body: { status: 'done' } });
			expect(await (await call(taskList.GET, { as, space: via })).json()).toEqual([]);
			expect((await (await call(archive.GET, { as, space: via })).json()).tasks).toEqual([]);
			expect((await (await call(archive.GET, { as: writer(owner), space: owner })).json()).tasks).toHaveLength(1);
		});

		it('ne peut pas être écrasée en réutilisant son id à la création (409)', async () => {
			const status = await statusOf(
				call(taskList.POST, { as, space: via, method: 'POST', body: { id, title: 'Écrasée' } })
			);
			expect(status).toBe(409);
			expect(await getTask(db, owner, id)).toMatchObject({ title: `Secret ${owner}` });
			expect(await getTask(db, via, id)).toBeUndefined();
		});
	}
);

describe.each([
	{ owner: 'perso', via: 'pro', as: 'visitor' },
	{ owner: 'pro', via: 'perso', as: 'perso' }
] satisfies { owner: SpaceId; via: SpaceId; as: Caller }[])(
	'une récurrence $owner, via l’API $via',
	({ owner, via, as }) => {
		let id: string;
		const body = { title: `Routine ${owner}`, preset: { kind: 'daily' }, startDate: '2026-10-20' };

		beforeEach(async () => {
			const res = await call(recurrenceList.POST, { as: writer(owner), space: owner, method: 'POST', body });
			expect(res.status).toBe(201);
			id = (await res.json()).id;
			await generateDueOccurrences(db, owner, '2026-10-22');
		});

		it('est introuvable : ni lecture, ni modification, ni suppression (404)', async () => {
			const opts = { as, space: via, id };
			expect(await statusOf(call(recurrenceById.GET, opts))).toBe(404);
			expect(
				await statusOf(
					call(recurrenceById.PATCH, { ...opts, method: 'PATCH', body: { title: 'piraté', active: false } })
				)
			).toBe(404);
			expect(await statusOf(call(recurrenceById.DELETE, { ...opts, method: 'DELETE' }))).toBe(404);
			expect(await (await call(recurrenceList.GET, { as, space: via })).json()).toEqual([]);
			expect(await getRecurrence(db, owner, id)).toMatchObject({ title: `Routine ${owner}`, active: true, openCount: 3 });
		});

		it("la génération de l'autre espace n'en tire rien", async () => {
			expect(await generateDueOccurrences(db, via, '2026-10-30')).toBe(0);
			expect(await (await call(taskList.GET, { as, space: via })).json()).toEqual([]);
		});
	}
);

describe('propriétaire', () => {
	it('peut renvoyer la même création sans doublon', async () => {
		const id = crypto.randomUUID();
		const body = { id, title: 'Une fois' };
		for (let i = 0; i < 2; i++) {
			expect(await statusOf(call(taskList.POST, { as: 'perso', space: 'perso', method: 'POST', body }))).toBe(201);
		}
		expect(await (await call(taskList.GET, { as: 'perso', space: 'perso' })).json()).toHaveLength(1);
	});
});
