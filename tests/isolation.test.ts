import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieName, createSession, SESSION_TTL_MS } from '$lib/server/auth';
import type { Db } from '$lib/server/db/client';
import { generateDueOccurrences } from '$lib/server/recurrence/generate';
import { getRecurrence } from '$lib/server/repo/recurrences';
import { getTask } from '$lib/server/repo/tasks';
import { PROFILE_SPACE, scopeOf, type ProfileId } from '$lib/spaces';
import * as archive from '../src/routes/api/[profile=profile]/archive/+server';
import * as projectById from '../src/routes/api/[profile=profile]/projects/[id]/+server';
import * as stageById from '../src/routes/api/[profile=profile]/projects/[id]/stages/[stageId]/+server';
import * as stageOrder from '../src/routes/api/[profile=profile]/projects/[id]/stages/order/+server';
import * as stageList from '../src/routes/api/[profile=profile]/projects/[id]/stages/+server';
import * as projectTaskById from '../src/routes/api/[profile=profile]/projects/[id]/tasks/[taskId]/+server';
import * as projectTaskList from '../src/routes/api/[profile=profile]/projects/[id]/tasks/+server';
import * as projectList from '../src/routes/api/[profile=profile]/projects/+server';
import * as recurrenceById from '../src/routes/api/[profile=profile]/recurrences/[id]/+server';
import * as recurrencePreview from '../src/routes/api/[profile=profile]/recurrences/preview/+server';
import * as recurrenceList from '../src/routes/api/[profile=profile]/recurrences/+server';
import * as taskById from '../src/routes/api/[profile=profile]/tasks/[id]/+server';
import * as taskList from '../src/routes/api/[profile=profile]/tasks/+server';
import { createTestDb, fakeEvent, seedSpaces, statusOf } from './helpers';

// Modèle d'accès : Pro est en accès libre ; Perso exige une session (code du jour).
// Un visiteur sans session peut donc utiliser l'API Pro : elle ne doit jamais atteindre une donnée Perso.
// Entre Thibaut et Philippe (Pro), pas de code, mais des données tout aussi séparées.

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

type CallOptions = {
	as: Caller;
	profile: ProfileId;
	id?: string;
	method?: string;
	body?: unknown;
	/** Autres paramètres d'adresse (stageId, taskId). */
	params?: Record<string, string>;
	/** Paramètres de requête, sans le « ? ». */
	query?: string;
};

function call(handler: Handler, { as, profile, id, method, body, params = {}, query = '' }: CallOptions) {
	const event = fakeEvent({
		db,
		params: { profile, ...(id ? { id } : {}), ...params },
		cookies: as === 'perso' ? { [cookieName('perso')]: persoToken } : {},
		method,
		body,
		url: `http://localhost/?${query}`
	});
	return handler(event as never);
}

/** Qui a le droit d'écrire dans chaque profil : n'importe qui pour Pro, la session Perso pour Perso. */
const writer = (profile: ProfileId): Caller => (PROFILE_SPACE[profile] === 'perso' ? 'perso' : 'visitor');

async function createTaskIn(profile: ProfileId, title: string) {
	const id = crypto.randomUUID();
	const status = await statusOf(call(taskList.POST, { as: writer(profile), profile, method: 'POST', body: { id, title } }));
	expect(status).toBe(201);
	return id;
}

describe('accès', () => {
	it('un visiteur sans code utilise Pro librement', async () => {
		const id = await createTaskIn('thibaut', 'Rapport');
		const opts = { as: 'visitor', profile: 'thibaut', id } as const;
		expect(await statusOf(call(taskList.GET, { as: 'visitor', profile: 'thibaut' }))).toBe(200);
		expect(await statusOf(call(taskById.PATCH, { ...opts, method: 'PATCH', body: { status: 'done' } }))).toBe(200);
		expect(await statusOf(call(archive.GET, { as: 'visitor', profile: 'thibaut' }))).toBe(200);
		expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(204);
	});

	it('un visiteur sans code est refusé partout dans Perso (401)', async () => {
		const id = await createTaskIn('perso', 'Secret');
		const recurrence = await (
			await call(recurrenceList.POST, {
				as: 'perso',
				profile: 'perso',
				method: 'POST',
				body: { title: 'Routine', preset: { kind: 'daily' }, startDate: '2026-10-20' }
			})
		).json();
		const opts = { as: 'visitor', profile: 'perso' } as const;
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

		expect(await getTask(db, scopeOf('perso'), id)).toMatchObject({ title: 'Secret', status: 'open' });
		expect(await getRecurrence(db, scopeOf('perso'), recurrence.id)).toMatchObject({ active: true });
	});

	it('refuse un jeton Perso inconnu, supprimé ou expiré', async () => {
		const forged = fakeEvent({ db, params: { profile: 'perso' }, cookies: { [cookieName('perso')]: 'invente' } });
		expect(await statusOf(taskList.GET(forged as never))).toBe(401);

		const old = await createSession(db, 'perso', Date.now() - SESSION_TTL_MS - 1000);
		const expired = fakeEvent({ db, params: { profile: 'perso' }, cookies: { [cookieName('perso')]: old } });
		expect(await statusOf(taskList.GET(expired as never))).toBe(401);
	});

	it('une session Perso ouvre Perso', async () => {
		await createTaskIn('perso', 'Mienne');
		const res = await call(taskList.GET, { as: 'perso', profile: 'perso' });
		expect(await res.json()).toHaveLength(1);
	});
});

// Étanchéité des données : une ressource n'est jamais atteignable via l'API d'un autre profil,
// qu'il soit dans l'autre espace ou dans le même (Thibaut et Philippe).
const CROSSINGS = [
	{ owner: 'perso', via: 'thibaut', as: 'visitor' },
	{ owner: 'perso', via: 'philippe', as: 'visitor' },
	{ owner: 'thibaut', via: 'perso', as: 'perso' },
	{ owner: 'thibaut', via: 'philippe', as: 'visitor' },
	{ owner: 'philippe', via: 'thibaut', as: 'visitor' }
] satisfies { owner: ProfileId; via: ProfileId; as: Caller }[];

describe.each(CROSSINGS)(
	'une tâche $owner, via l’API $via',
	({ owner, via, as }) => {
		let id: string;
		beforeEach(async () => {
			id = await createTaskIn(owner, `Secret ${owner}`);
		});

		it('est introuvable : ni lecture, ni modification, ni suppression (404)', async () => {
			const opts = { as, profile: via, id };
			expect(await statusOf(call(taskById.GET, opts))).toBe(404);
			expect(
				await statusOf(call(taskById.PATCH, { ...opts, method: 'PATCH', body: { title: 'piraté', status: 'done' } }))
			).toBe(404);
			expect(await statusOf(call(taskById.DELETE, { ...opts, method: 'DELETE' }))).toBe(404);
			expect(await getTask(db, scopeOf(owner), id)).toMatchObject({ title: `Secret ${owner}`, status: 'open' });
		});

		it('n’apparaît ni dans la liste ni dans l’archive', async () => {
			await call(taskById.PATCH, { as: writer(owner), profile: owner, id, method: 'PATCH', body: { status: 'done' } });
			expect(await (await call(taskList.GET, { as, profile: via })).json()).toEqual([]);
			expect((await (await call(archive.GET, { as, profile: via })).json()).tasks).toEqual([]);
			expect((await (await call(archive.GET, { as: writer(owner), profile: owner })).json()).tasks).toHaveLength(1);
		});

		it('ne peut pas être écrasée en réutilisant son id à la création (409)', async () => {
			const status = await statusOf(
				call(taskList.POST, { as, profile: via, method: 'POST', body: { id, title: 'Écrasée' } })
			);
			expect(status).toBe(409);
			expect(await getTask(db, scopeOf(owner), id)).toMatchObject({ title: `Secret ${owner}` });
			expect(await getTask(db, scopeOf(via), id)).toBeUndefined();
		});
	}
);

describe.each(CROSSINGS)(
	'une récurrence $owner, via l’API $via',
	({ owner, via, as }) => {
		let id: string;
		const body = { title: `Routine ${owner}`, preset: { kind: 'daily' }, startDate: '2026-10-20' };

		beforeEach(async () => {
			const res = await call(recurrenceList.POST, { as: writer(owner), profile: owner, method: 'POST', body });
			expect(res.status).toBe(201);
			id = (await res.json()).id;
			await generateDueOccurrences(db, scopeOf(owner), '2026-10-22');
		});

		it('est introuvable : ni lecture, ni modification, ni suppression (404)', async () => {
			const opts = { as, profile: via, id };
			expect(await statusOf(call(recurrenceById.GET, opts))).toBe(404);
			expect(
				await statusOf(
					call(recurrenceById.PATCH, { ...opts, method: 'PATCH', body: { title: 'piraté', active: false } })
				)
			).toBe(404);
			expect(await statusOf(call(recurrenceById.DELETE, { ...opts, method: 'DELETE' }))).toBe(404);
			expect(await (await call(recurrenceList.GET, { as, profile: via })).json()).toEqual([]);
			expect(await getRecurrence(db, scopeOf(owner), id)).toMatchObject({ title: `Routine ${owner}`, active: true, openCount: 3 });
		});

		it("la génération de l'autre profil n'en tire rien", async () => {
			expect(await generateDueOccurrences(db, scopeOf(via), '2026-10-30')).toBe(0);
			expect(await (await call(taskList.GET, { as, profile: via })).json()).toEqual([]);
		});
	}
);

describe('propriétaire', () => {
	it('peut renvoyer la même création sans doublon', async () => {
		const id = crypto.randomUUID();
		const body = { id, title: 'Une fois' };
		for (let i = 0; i < 2; i++) {
			expect(await statusOf(call(taskList.POST, { as: 'perso', profile: 'perso', method: 'POST', body }))).toBe(201);
		}
		expect(await (await call(taskList.GET, { as: 'perso', profile: 'perso' })).json()).toHaveLength(1);
	});
});

// --- Chantiers : communs aux profils d'un espace, jamais visibles depuis l'autre espace. ---

async function createProjectIn(profile: ProfileId) {
	const as = writer(profile);
	const project = await (
		await call(projectList.POST, { as, profile, method: 'POST', body: { name: `Chantier ${profile}` } })
	).json();
	const stage = await (
		await call(stageList.POST, {
			as,
			profile,
			id: project.id,
			method: 'POST',
			body: { name: 'Étape', startDate: '2026-11-02', endDate: '2026-11-06' }
		})
	).json();
	const taskId = crypto.randomUUID();
	const created = await call(projectTaskList.POST, {
		as,
		profile,
		id: project.id,
		method: 'POST',
		body: { id: taskId, title: 'Secrète', stageId: stage.id, profileId: profile }
	});
	expect(created.status).toBe(201);
	return { projectId: project.id as string, stageId: stage.id as string, taskId };
}

/** Tous les endpoints de chantier, pour un chantier donné. */
function projectAttempts(opts: { as: Caller; profile: ProfileId }, { projectId, stageId, taskId }: Awaited<ReturnType<typeof createProjectIn>>) {
	const on = { ...opts, id: projectId };
	return [
		[projectById.GET, on],
		[projectById.PATCH, { ...on, method: 'PATCH', body: { name: 'piraté', status: 'done' } }],
		[stageList.POST, { ...on, method: 'POST', body: { name: 'x', startDate: '2026-11-01', endDate: '2026-11-01' } }],
		[stageOrder.PUT, { ...on, method: 'PUT', body: { ids: [stageId] } }],
		[stageById.PATCH, { ...on, params: { stageId }, method: 'PATCH', body: { name: 'piraté' } }],
		[stageById.DELETE, { ...on, params: { stageId }, method: 'DELETE', query: 'tasks=delete' }],
		[
			projectTaskList.POST,
			{ ...on, method: 'POST', body: { id: crypto.randomUUID(), title: 'x', stageId, profileId: opts.profile } }
		],
		[projectTaskById.PATCH, { ...on, params: { taskId }, method: 'PATCH', body: { status: 'done' } }],
		[projectTaskById.DELETE, { ...on, params: { taskId }, method: 'DELETE' }],
		[projectById.DELETE, { ...on, method: 'DELETE' }]
	] as [Handler, CallOptions][];
}

describe('chantiers', () => {
	it('Perso : tout est refusé sans session (401), et rien ne change', async () => {
		const perso = await createProjectIn('perso');
		const visitor = { as: 'visitor', profile: 'perso' } as const;
		expect(await statusOf(call(projectList.GET, visitor))).toBe(401);
		expect(await statusOf(call(projectList.POST, { ...visitor, method: 'POST', body: { name: 'x' } }))).toBe(401);
		for (const [handler, args] of projectAttempts(visitor, perso)) {
			expect(await statusOf(call(handler, args))).toBe(401);
		}
		const project = await (await call(projectById.GET, { as: 'perso', profile: 'perso', id: perso.projectId })).json();
		expect(project).toMatchObject({ name: 'Chantier perso', status: 'open' });
		expect(project.stages[0].tasks).toMatchObject([{ id: perso.taskId, status: 'open' }]);
	});

	describe.each([
		{ owner: 'perso', via: 'thibaut', as: 'visitor' },
		{ owner: 'perso', via: 'philippe', as: 'visitor' },
		{ owner: 'thibaut', via: 'perso', as: 'perso' }
	] satisfies { owner: ProfileId; via: ProfileId; as: Caller }[])(
		'un chantier $owner, via l’API $via',
		({ owner, via, as }) => {
			it('est introuvable partout (404), absent des listes, et intact', async () => {
				const target = await createProjectIn(owner);
				for (const [handler, args] of projectAttempts({ as, profile: via }, target)) {
					expect(await statusOf(call(handler, args))).toBe(404);
				}
				expect(await (await call(projectList.GET, { as, profile: via })).json()).toEqual([]);
				const project = await (
					await call(projectById.GET, { as: writer(owner), profile: owner, id: target.projectId })
				).json();
				expect(project).toMatchObject({ name: `Chantier ${owner}`, status: 'open' });
				expect(project.stages).toHaveLength(1);
				expect(project.stages[0].tasks).toMatchObject([{ id: target.taskId, title: 'Secrète', status: 'open' }]);
			});
		}
	);

	it('Thibaut et Philippe partagent les chantiers de Pro', async () => {
		const { projectId } = await createProjectIn('thibaut');
		const res = await call(projectById.GET, { as: 'visitor', profile: 'philippe', id: projectId });
		expect(res.status).toBe(200);
	});

	it('une tâche ne peut aller ni dans l’étape d’un autre espace, ni à un profil d’un autre espace', async () => {
		const pro = await createProjectIn('thibaut');
		const perso = await createProjectIn('perso');
		const opts = { as: 'visitor', profile: 'thibaut', id: pro.projectId, params: { taskId: pro.taskId } } as const;
		expect(
			await statusOf(call(projectTaskById.PATCH, { ...opts, method: 'PATCH', body: { stageId: perso.stageId } }))
		).toBe(404);
		expect(
			await statusOf(call(projectTaskById.PATCH, { ...opts, method: 'PATCH', body: { profileId: 'perso' } }))
		).toBe(400);
		const persoOpts = { as: 'perso', profile: 'perso', id: perso.projectId } as const;
		expect(
			await statusOf(
				call(projectTaskList.POST, {
					...persoOpts,
					method: 'POST',
					body: { id: crypto.randomUUID(), title: 'x', stageId: perso.stageId, profileId: 'philippe' }
				})
			)
		).toBe(400);
	});

	it('une tâche de chantier Pro reste introuvable via l’API des tâches de Perso', async () => {
		const pro = await createProjectIn('thibaut');
		expect(await statusOf(call(taskById.GET, { as: 'perso', profile: 'perso', id: pro.taskId }))).toBe(404);
		expect(await getTask(db, scopeOf('thibaut'), pro.taskId)).toMatchObject({ stageId: pro.stageId });
	});
});
