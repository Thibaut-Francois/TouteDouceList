import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import {
	createProject,
	createProjectTask,
	createStage,
	deleteProject,
	deleteStage,
	getProject,
	listProjects,
	reorderStages,
	updateProject,
	updateProjectTask,
	updateStage
} from '$lib/server/repo/projects';
import { getTask, listArchive, listOpenTasks, updateTask } from '$lib/server/repo/tasks';
import { createTestDb, PHILIPPE, seedSpaces, THIBAUT } from './helpers';

let db: Db;
let cleanup: () => void;
let projectId: string;
let stageIds: string[];

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
	projectId = (await createProject(db, 'pro', { name: 'Rénovation', description: '' })).id;
	stageIds = [];
	for (const [name, startDate, endDate] of [
		['Démolition', '2026-11-02', '2026-11-06'],
		['Placo', '2026-11-09', '2026-11-13'],
		['Peinture', '2026-11-16', '2026-11-20']
	]) {
		stageIds.push((await createStage(db, 'pro', projectId, { name, startDate, endDate }))!.id);
	}
});
afterEach(() => cleanup());

const stageNames = async () => (await getProject(db, 'pro', projectId))!.stages.map((s) => [s.name, s.position]);

async function addTask(stageId: string, title: string, profileId: 'thibaut' | 'philippe' = 'thibaut') {
	const task = await createProjectTask(db, 'pro', projectId, {
		id: crypto.randomUUID(),
		title,
		notes: '',
		priority: 3,
		dueDate: null,
		stageId,
		profileId
	});
	if (typeof task === 'string') throw new Error(task);
	return task;
}

describe('ordre des étapes', () => {
	it('les nouvelles étapes vont à la fin', async () => {
		expect(await stageNames()).toEqual([
			['Démolition', 0],
			['Placo', 1],
			['Peinture', 2]
		]);
	});

	it('après déplacement', async () => {
		expect(await reorderStages(db, 'pro', projectId, [stageIds[2], stageIds[0], stageIds[1]])).toBe('ok');
		expect(await stageNames()).toEqual([
			['Peinture', 0],
			['Démolition', 1],
			['Placo', 2]
		]);
	});

	it('refuse un ordre incomplet, en double ou avec une étape d’un autre chantier', async () => {
		const other = (await createProject(db, 'pro', { name: 'Autre', description: '' })).id;
		const foreign = (await createStage(db, 'pro', other, { name: 'X', startDate: '2026-11-01', endDate: '2026-11-01' }))!.id;
		for (const ids of [
			[stageIds[0], stageIds[1]],
			[stageIds[0], stageIds[1], stageIds[1]],
			[stageIds[0], stageIds[1], foreign],
			[...stageIds, foreign]
		]) {
			expect(await reorderStages(db, 'pro', projectId, ids)).toBe('invalid');
		}
		expect((await stageNames()).map(([name]) => name)).toEqual(['Démolition', 'Placo', 'Peinture']);
	});

	it('après suppression, les positions restent continues', async () => {
		expect(await deleteStage(db, 'pro', projectId, stageIds[0], {})).toBe('deleted');
		expect(await stageNames()).toEqual([
			['Placo', 0],
			['Peinture', 1]
		]);
	});
});

describe('suppression d’une étape avec des tâches', () => {
	it('demande un choix s’il reste des tâches ouvertes', async () => {
		await addTask(stageIds[1], 'Poser placo');
		expect(await deleteStage(db, 'pro', projectId, stageIds[1], {})).toBe('needs-choice');
		expect(await stageNames()).toHaveLength(3);
	});

	it('déplace toutes ses tâches (ouvertes et faites) vers l’étape choisie', async () => {
		const open = await addTask(stageIds[1], 'Poser placo');
		const done = await addTask(stageIds[1], 'Acheter rails');
		await updateTask(db, THIBAUT, done.id, { status: 'done' });

		expect(await deleteStage(db, 'pro', projectId, stageIds[1], { moveTo: stageIds[2] })).toBe('deleted');
		const project = (await getProject(db, 'pro', projectId))!;
		expect(project.stages.map((s) => s.name)).toEqual(['Démolition', 'Peinture']);
		expect(project.stages[1].tasks.map((t) => t.id).sort()).toEqual([open.id, done.id].sort());
	});

	it('refuse de déplacer vers elle-même ou vers une étape d’un autre chantier', async () => {
		await addTask(stageIds[1], 'Poser placo');
		const other = (await createProject(db, 'pro', { name: 'Autre', description: '' })).id;
		const foreign = (await createStage(db, 'pro', other, { name: 'X', startDate: '2026-11-01', endDate: '2026-11-01' }))!.id;
		expect(await deleteStage(db, 'pro', projectId, stageIds[1], { moveTo: stageIds[1] })).toBe('invalid-target');
		expect(await deleteStage(db, 'pro', projectId, stageIds[1], { moveTo: foreign })).toBe('invalid-target');
	});

	it('ou supprime les ouvertes ; les faites restent dans l’archive du profil', async () => {
		const open = await addTask(stageIds[1], 'Poser placo');
		const done = await addTask(stageIds[1], 'Acheter rails', 'philippe');
		await updateTask(db, PHILIPPE, done.id, { status: 'done' });

		expect(await deleteStage(db, 'pro', projectId, stageIds[1], { deleteOpen: true })).toBe('deleted');
		expect(await getTask(db, THIBAUT, open.id)).toBeUndefined();
		const archived = (await listArchive(db, PHILIPPE)).tasks;
		expect(archived.map((t) => [t.id, t.stageId])).toEqual([[done.id, null]]);
	});
});

describe('tâches de chantier', () => {
	it('apparaissent dans la liste du profil attribué ; cochées d’un côté, cochées partout', async () => {
		const placo = await addTask(stageIds[1], 'Poser placo', 'philippe');
		expect((await listOpenTasks(db, PHILIPPE)).map((t) => t.id)).toEqual([placo.id]);
		expect(await listOpenTasks(db, THIBAUT)).toEqual([]);

		// Cochée depuis la liste de Philippe : cochée dans le chantier.
		await updateTask(db, PHILIPPE, placo.id, { status: 'done' });
		const inProject = (await getProject(db, 'pro', projectId))!.stages[1].tasks[0];
		expect(inProject).toMatchObject({ id: placo.id, status: 'done' });

		// Rouverte depuis le chantier : de retour dans la liste de Philippe.
		await updateProjectTask(db, 'pro', projectId, placo.id, { status: 'open' });
		expect((await listOpenTasks(db, PHILIPPE)).map((t) => t.id)).toEqual([placo.id]);
	});

	it('réattribuer une tâche la fait passer d’une liste à l’autre', async () => {
		const placo = await addTask(stageIds[1], 'Poser placo', 'philippe');
		await updateProjectTask(db, 'pro', projectId, placo.id, { profileId: 'thibaut', title: 'Poser le placo' });
		expect(await listOpenTasks(db, PHILIPPE)).toEqual([]);
		expect(await listOpenTasks(db, THIBAUT)).toMatchObject([{ id: placo.id, title: 'Poser le placo' }]);
	});

	it('refuse une étape d’un autre chantier et une personne d’un autre espace', async () => {
		const placo = await addTask(stageIds[1], 'Poser placo');
		const other = (await createProject(db, 'pro', { name: 'Autre', description: '' })).id;
		const foreign = (await createStage(db, 'pro', other, { name: 'X', startDate: '2026-11-01', endDate: '2026-11-01' }))!.id;
		expect(await updateProjectTask(db, 'pro', projectId, placo.id, { stageId: foreign })).toBe('not-found');
		expect(await updateProjectTask(db, 'pro', projectId, placo.id, { profileId: 'perso' })).toBe('invalid-assignee');
		expect(
			await createProjectTask(db, 'pro', projectId, {
				id: crypto.randomUUID(),
				title: 'x',
				notes: '',
				priority: 3,
				dueDate: null,
				stageId: stageIds[0],
				profileId: 'perso'
			})
		).toBe('invalid-assignee');
		// Une tâche d'un autre chantier n'est pas atteignable par celui-ci.
		expect(await updateProjectTask(db, 'pro', other, placo.id, { title: 'piraté' })).toBe('not-found');
	});

	it('création idempotente ; id déjà pris ailleurs → conflit', async () => {
		const input = { id: crypto.randomUUID(), title: 'Une fois', notes: '', priority: 3, dueDate: null };
		const stage = { stageId: stageIds[0], profileId: 'thibaut' as const };
		expect(await createProjectTask(db, 'pro', projectId, { ...input, ...stage })).toMatchObject({ id: input.id });
		expect(await createProjectTask(db, 'pro', projectId, { ...input, ...stage })).toMatchObject({ id: input.id });
		const other = (await createProject(db, 'pro', { name: 'Autre', description: '' })).id;
		const foreign = (await createStage(db, 'pro', other, { name: 'X', startDate: '2026-11-01', endDate: '2026-11-01' }))!.id;
		expect(await createProjectTask(db, 'pro', other, { ...input, stageId: foreign, profileId: 'thibaut' })).toBe(
			'conflict'
		);
	});
});

describe('chantier', () => {
	it('compteurs par étape dans la liste', async () => {
		await addTask(stageIds[1], 'a');
		const b = await addTask(stageIds[1], 'b', 'philippe');
		await updateTask(db, PHILIPPE, b.id, { status: 'done' });
		const [summary] = await listProjects(db, 'pro');
		expect(summary.stages.map((s) => s.counts)).toEqual([
			{ total: 0, done: 0 },
			{ total: 2, done: 1 },
			{ total: 0, done: 0 }
		]);
	});

	it('terminé puis restauré, sans toucher à ses tâches', async () => {
		const open = await addTask(stageIds[0], 'Reste à faire');
		await updateProject(db, 'pro', projectId, { status: 'done' }, 5000);
		expect(await listProjects(db, 'pro')).toEqual([]);
		expect(await listProjects(db, 'pro', 'done')).toMatchObject([{ id: projectId, completedAt: 5000 }]);
		expect((await listOpenTasks(db, THIBAUT)).map((t) => t.id)).toEqual([open.id]);

		await updateProject(db, 'pro', projectId, { status: 'open' });
		expect(await listProjects(db, 'pro')).toMatchObject([{ id: projectId, status: 'open', completedAt: null }]);
	});

	it('suppression définitive : étapes et tâches comprises', async () => {
		const task = await addTask(stageIds[0], 'Disparaît');
		expect(await deleteProject(db, 'pro', projectId)).toBe(true);
		expect(await getProject(db, 'pro', projectId)).toBeUndefined();
		expect(await getTask(db, THIBAUT, task.id)).toBeUndefined();
		const left = await db.$client.execute('SELECT count(*) AS n FROM stages');
		expect(Number(left.rows[0].n)).toBe(0);
	});

	it('dates d’étape : début ≤ fin, vérifié après fusion avec l’étape', async () => {
		expect(await updateStage(db, 'pro', projectId, stageIds[0], { endDate: '2026-11-01' })).toBe('invalid');
		expect(await updateStage(db, 'pro', projectId, stageIds[0], { endDate: '2026-11-02' })).toMatchObject({
			startDate: '2026-11-02',
			endDate: '2026-11-02'
		});
	});
});

it('les listes du profil donnent le chantier et l’étape (badge « Chantier › Étape »)', async () => {
	const placo = await addTask(stageIds[1], 'Poser placo', 'philippe');
	const context = { projectId, projectName: 'Rénovation', stageName: 'Placo' };
	expect(await listOpenTasks(db, PHILIPPE)).toMatchObject([{ id: placo.id, ...context }]);
	await updateTask(db, PHILIPPE, placo.id, { status: 'done' });
	expect((await listArchive(db, PHILIPPE)).tasks).toMatchObject([{ id: placo.id, ...context }]);
});
