import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieName, createSession } from '$lib/server/auth';
import type { Db } from '$lib/server/db/client';
import { getTask } from '$lib/server/repo/tasks';
import type { SpaceId } from '$lib/spaces';
import * as taskById from '../src/routes/api/[space=space]/tasks/[id]/+server';
import * as taskList from '../src/routes/api/[space=space]/tasks/+server';
import { createTestDb, fakeEvent, seedSpaces, statusOf } from './helpers';

let db: Db;
let cleanup: () => void;
const tokens = {} as Record<SpaceId, string>;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
	tokens.pro = await createSession(db, 'pro');
	tokens.perso = await createSession(db, 'perso');
});
afterEach(() => cleanup());

function call(
	handler: (event: never) => Response | Promise<Response>,
	{ as, space, id, method, body }: { as: SpaceId; space: SpaceId; id?: string; method?: string; body?: unknown }
) {
	const event = fakeEvent({
		db,
		params: id ? { space, id } : { space },
		cookies: { [cookieName(as)]: tokens[as] },
		method,
		body
	});
	return handler(event as never);
}

async function createIn(space: SpaceId, title: string) {
	const id = crypto.randomUUID();
	const status = await statusOf(
		call(taskList.POST, { as: space, space, method: 'POST', body: { id, title } })
	);
	expect(status).toBe(201);
	return id;
}

describe.each([
	{ owner: 'pro', intruder: 'perso' },
	{ owner: 'perso', intruder: 'pro' }
] satisfies { owner: SpaceId; intruder: SpaceId }[])(
	'une session $intruder face à une tâche $owner',
	({ owner, intruder }) => {
		let id: string;
		beforeEach(async () => {
			id = await createIn(owner, `Secret ${owner}`);
		});

		it("ne peut pas utiliser l'API de l'autre espace (401)", async () => {
			const opts = { as: intruder, space: owner, id };
			expect(await statusOf(call(taskList.GET, { as: intruder, space: owner }))).toBe(401);
			expect(await statusOf(call(taskById.GET, opts))).toBe(401);
			expect(
				await statusOf(call(taskById.PATCH, { ...opts, method: 'PATCH', body: { title: 'x' } }))
			).toBe(401);
			expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(401);
		});

		it("ne voit pas la tâche via son propre espace (404) et ne peut pas la modifier", async () => {
			const opts = { as: intruder, space: intruder, id };
			expect(await statusOf(call(taskById.GET, opts))).toBe(404);
			expect(
				await statusOf(
					call(taskById.PATCH, { ...opts, method: 'PATCH', body: { title: 'piraté', status: 'done' } })
				)
			).toBe(404);
			expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(404);

			const task = await getTask(db, owner, id);
			expect(task).toMatchObject({ title: `Secret ${owner}`, status: 'open' });
		});

		it('ne la voit pas dans sa liste', async () => {
			const res = await call(taskList.GET, { as: intruder, space: intruder });
			expect(await res.json()).toEqual([]);
		});

		it("ne peut pas l'écraser en réutilisant son id à la création (409)", async () => {
			const status = await statusOf(
				call(taskList.POST, {
					as: intruder,
					space: intruder,
					method: 'POST',
					body: { id, title: 'Écrasée' }
				})
			);
			expect(status).toBe(409);
			expect(await getTask(db, owner, id)).toMatchObject({ title: `Secret ${owner}` });
			expect(await getTask(db, intruder, id)).toBeUndefined();
		});

		it("refuse le jeton d'un espace présenté dans le cookie de l'autre", async () => {
			const event = fakeEvent({
				db,
				params: { space: intruder },
				cookies: { [cookieName(intruder)]: tokens[owner] }
			});
			expect(await statusOf(taskList.GET(event as never))).toBe(401);
		});
	}
);

describe('propriétaire', () => {
	it('peut lire, modifier et supprimer ses tâches', async () => {
		const id = await createIn('pro', 'Rapport');
		const opts = { as: 'pro', space: 'pro', id } as const;
		expect(await statusOf(call(taskById.GET, opts))).toBe(200);
		expect(
			await statusOf(call(taskById.PATCH, { ...opts, method: 'PATCH', body: { status: 'done' } }))
		).toBe(200);
		expect(await getTask(db, 'pro', id)).toMatchObject({ status: 'done' });
		expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(204);
		expect(await getTask(db, 'pro', id)).toBeUndefined();
	});

	it('peut renvoyer la même création sans doublon', async () => {
		const id = crypto.randomUUID();
		const body = { id, title: 'Une fois' };
		for (let i = 0; i < 2; i++) {
			expect(
				await statusOf(call(taskList.POST, { as: 'perso', space: 'perso', method: 'POST', body }))
			).toBe(201);
		}
		const res = await call(taskList.GET, { as: 'perso', space: 'perso' });
		expect(await res.json()).toHaveLength(1);
	});
});
