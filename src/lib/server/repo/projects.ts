import { and, asc, desc, eq, inArray, max, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { randomUUID } from 'node:crypto';
import type { TaskCounts } from '$lib/projects';
import { isProfileId, PROFILE_SPACE, type ProfileId, type SpaceId } from '$lib/spaces';
import { searchText } from '$lib/text';
import type { Db } from '../db/client';
import { projects, stages, tasks } from '../db/schema';
import { taskColumns, updateTaskWhere, type NewTaskInput, type Task, type TaskWrite } from './tasks';

// Les chantiers appartiennent à un espace et sont communs à ses profils. Chaque fonction prend
// spaceId et vérifie toute la chaîne tâche → étape → chantier → espace : un chantier, une étape ou
// une tâche d'un autre espace est introuvable. Les suppressions sont explicites (pas de cascade
// implicite) et groupées dans un batch : tout ou rien.

export type Project = typeof projects.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type StageSummary = Stage & { counts: TaskCounts };
export type ProjectSummary = Project & { stages: StageSummary[] };
export type StageDetail = Stage & { tasks: Task[] };
export type ProjectDetail = Project & { stages: StageDetail[] };

export type ProjectInput = { name: string; description: string };
export type ProjectPatch = Partial<ProjectInput & { status: Project['status'] }>;
export type StageInput = { name: string; startDate: string; endDate: string };
export type StagePatch = Partial<StageInput>;
export type ProjectTaskInput = NewTaskInput & { stageId: string; profileId: ProfileId };

type Batch = [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]];

const inSpace = (spaceId: SpaceId, id: string) => and(eq(projects.spaceId, spaceId), eq(projects.id, id));

async function getProjectRow(db: Db, spaceId: SpaceId, id: string) {
	const [project] = await db.select().from(projects).where(inSpace(spaceId, id)).limit(1);
	return project;
}

function stagesOf(db: Db, projectIds: string[]) {
	if (projectIds.length === 0) return Promise.resolve([] as Stage[]);
	return db
		.select()
		.from(stages)
		.where(inArray(stages.projectId, projectIds))
		.orderBy(asc(stages.projectId), asc(stages.position));
}

/** Étape d'un chantier de l'espace. */
async function getStage(db: Db, spaceId: SpaceId, projectId: string, stageId: string) {
	const [row] = await db
		.select({ stage: stages })
		.from(stages)
		.innerJoin(projects, eq(projects.id, stages.projectId))
		.where(and(eq(stages.id, stageId), eq(stages.projectId, projectId), eq(projects.spaceId, spaceId)))
		.limit(1);
	return row?.stage;
}

async function countsByStage(db: Db, spaceId: SpaceId, stageIds: string[]) {
	const counts = new Map<string, TaskCounts>();
	if (stageIds.length === 0) return counts;
	const rows = await db
		.select({
			stageId: tasks.stageId,
			total: sql<number>`count(*)`,
			done: sql<number>`sum(case when ${tasks.status} = 'done' then 1 else 0 end)`
		})
		.from(tasks)
		.where(and(eq(tasks.spaceId, spaceId), inArray(tasks.stageId, stageIds)))
		.groupBy(tasks.stageId);
	for (const r of rows) counts.set(r.stageId!, { total: Number(r.total), done: Number(r.done) });
	return counts;
}

/** Chantiers ouverts (par date de création) ou terminés (du plus récent au plus ancien), avec leurs étapes et leurs compteurs. */
export async function listProjects(
	db: Db,
	spaceId: SpaceId,
	status: Project['status'] = 'open'
): Promise<ProjectSummary[]> {
	const rows = await db
		.select()
		.from(projects)
		.where(and(eq(projects.spaceId, spaceId), eq(projects.status, status)))
		.orderBy(status === 'open' ? asc(projects.createdAt) : desc(projects.completedAt));
	const allStages = await stagesOf(
		db,
		rows.map((p) => p.id)
	);
	const counts = await countsByStage(
		db,
		spaceId,
		allStages.map((s) => s.id)
	);
	return rows.map((project) => ({
		...project,
		stages: allStages
			.filter((s) => s.projectId === project.id)
			.map((s) => ({ ...s, counts: counts.get(s.id) ?? { total: 0, done: 0 } }))
	}));
}

/** Chantier avec ses étapes dans l'ordre, et toutes leurs tâches (faites comprises). */
export async function getProject(db: Db, spaceId: SpaceId, id: string): Promise<ProjectDetail | undefined> {
	const project = await getProjectRow(db, spaceId, id);
	if (!project) return undefined;
	const projectStages = await stagesOf(db, [id]);
	const stageIds = projectStages.map((s) => s.id);
	const stageTasks = stageIds.length
		? await db
				.select(taskColumns)
				.from(tasks)
				.where(and(eq(tasks.spaceId, spaceId), inArray(tasks.stageId, stageIds)))
				.orderBy(asc(tasks.createdAt))
		: [];
	return {
		...project,
		stages: projectStages.map((s) => ({ ...s, tasks: stageTasks.filter((t) => t.stageId === s.id) }))
	};
}

export async function createProject(db: Db, spaceId: SpaceId, input: ProjectInput, now = Date.now()) {
	const id = randomUUID();
	await db.insert(projects).values({ id, spaceId, ...input, status: 'open', createdAt: now });
	return (await getProject(db, spaceId, id))!;
}

/** Terminer un chantier ne touche pas à ses tâches : les ouvertes restent dans les listes des profils. */
export async function updateProject(
	db: Db,
	spaceId: SpaceId,
	id: string,
	patch: ProjectPatch,
	now = Date.now()
) {
	const values: Partial<Project> = { ...patch };
	if (patch.status === 'done') values.completedAt = now;
	if (patch.status === 'open') values.completedAt = null;
	if (Object.keys(values).length > 0) {
		await db.update(projects).set(values).where(inSpace(spaceId, id));
	}
	return getProject(db, spaceId, id);
}

/** Suppression définitive : le chantier, ses étapes et toutes leurs tâches. */
export async function deleteProject(db: Db, spaceId: SpaceId, id: string) {
	const project = await getProjectRow(db, spaceId, id);
	if (!project) return false;
	const stageIds = (await stagesOf(db, [id])).map((s) => s.id);
	const batch: Batch = [db.delete(projects).where(inSpace(spaceId, id))];
	if (stageIds.length) {
		batch.unshift(
			db.delete(tasks).where(and(eq(tasks.spaceId, spaceId), inArray(tasks.stageId, stageIds))),
			db.delete(stages).where(eq(stages.projectId, id))
		);
	}
	await db.batch(batch);
	return true;
}

// --- Étapes ---

export async function createStage(db: Db, spaceId: SpaceId, projectId: string, input: StageInput) {
	if (!(await getProjectRow(db, spaceId, projectId))) return undefined;
	const [{ last }] = await db
		.select({ last: max(stages.position) })
		.from(stages)
		.where(eq(stages.projectId, projectId));
	const stage = { id: randomUUID(), projectId, ...input, position: last === null ? 0 : last + 1 };
	await db.insert(stages).values(stage);
	return stage;
}

/** 'invalid' si les dates obtenues ne respectent pas début ≤ fin. */
export async function updateStage(
	db: Db,
	spaceId: SpaceId,
	projectId: string,
	stageId: string,
	patch: StagePatch
): Promise<Stage | undefined | 'invalid'> {
	const current = await getStage(db, spaceId, projectId, stageId);
	if (!current) return undefined;
	const next = { ...current, ...patch };
	if (next.startDate > next.endDate) return 'invalid';
	if (Object.keys(patch).length > 0) await db.update(stages).set(patch).where(eq(stages.id, stageId));
	return next;
}

/** Positions 0, 1, 2… dans l'ordre donné. */
function renumber(db: Db, ids: string[]) {
	return ids.map((id, position) => db.update(stages).set({ position }).where(eq(stages.id, id)));
}

/** Nouvel ordre des étapes : 'invalid' si ce n'est pas exactement l'ensemble des étapes du chantier. */
export async function reorderStages(
	db: Db,
	spaceId: SpaceId,
	projectId: string,
	ids: string[]
): Promise<'ok' | 'not-found' | 'invalid'> {
	if (!(await getProjectRow(db, spaceId, projectId))) return 'not-found';
	const current = (await stagesOf(db, [projectId])).map((s) => s.id);
	const same =
		ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
	if (!same) return 'invalid';
	const [first, ...rest] = renumber(db, ids);
	if (first) await db.batch([first, ...rest]);
	return 'ok';
}

export type StageDeletion =
	| { moveTo: string } // toutes les tâches (ouvertes et faites) passent dans cette étape
	| { deleteOpen: true } // les ouvertes sont supprimées ; les faites quittent l'étape et restent dans l'archive
	| Record<string, never>; // seulement si l'étape n'a pas de tâche ouverte

export async function deleteStage(
	db: Db,
	spaceId: SpaceId,
	projectId: string,
	stageId: string,
	choice: StageDeletion
): Promise<'deleted' | 'not-found' | 'needs-choice' | 'invalid-target'> {
	const stage = await getStage(db, spaceId, projectId, stageId);
	if (!stage) return 'not-found';
	const ofStage = and(eq(tasks.spaceId, spaceId), eq(tasks.stageId, stageId));

	const batch: Batch = [db.delete(stages).where(eq(stages.id, stageId))];
	if ('moveTo' in choice) {
		if (choice.moveTo === stageId || !(await getStage(db, spaceId, projectId, choice.moveTo))) {
			return 'invalid-target';
		}
		batch.unshift(db.update(tasks).set({ stageId: choice.moveTo }).where(ofStage));
	} else {
		const [{ open }] = await db
			.select({ open: sql<number>`count(*)` })
			.from(tasks)
			.where(and(ofStage, eq(tasks.status, 'open')));
		if (Number(open) > 0 && !('deleteOpen' in choice)) return 'needs-choice';
		batch.unshift(
			db.delete(tasks).where(and(ofStage, eq(tasks.status, 'open'))),
			db.update(tasks).set({ stageId: null }).where(ofStage)
		);
	}

	const remaining = (await stagesOf(db, [projectId])).map((s) => s.id).filter((id) => id !== stageId);
	batch.push(...renumber(db, remaining));
	await db.batch(batch);
	return 'deleted';
}

// --- Tâches de chantier ---

/** La tâche, si elle est dans une étape de ce chantier (lui-même dans l'espace : vérifié par l'appelant). */
const taskInProject = (spaceId: SpaceId, projectId: string, taskId: string): SQL | undefined =>
	and(
		eq(tasks.id, taskId),
		eq(tasks.spaceId, spaceId),
		inArray(tasks.stageId, sql`(select ${stages.id} from ${stages} where ${stages.projectId} = ${projectId})`)
	);

const canBeAssigned = (spaceId: SpaceId, profileId: string) =>
	isProfileId(profileId) && PROFILE_SPACE[profileId] === spaceId;

/**
 * Idempotent comme createTask. Renvoie 'not-found' (chantier ou étape), 'invalid-assignee'
 * (profil d'un autre espace) ou 'conflict' (id déjà pris ailleurs).
 */
export async function createProjectTask(
	db: Db,
	spaceId: SpaceId,
	projectId: string,
	{ stageId, profileId, ...input }: ProjectTaskInput,
	now = Date.now()
): Promise<Task | 'not-found' | 'invalid-assignee' | 'conflict'> {
	if (!(await getStage(db, spaceId, projectId, stageId))) return 'not-found';
	if (!canBeAssigned(spaceId, profileId)) return 'invalid-assignee';
	await db
		.insert(tasks)
		.values({
			...input,
			spaceId,
			profileId,
			stageId,
			status: 'open',
			createdAt: now,
			search: searchText(input.title, input.notes)
		})
		.onConflictDoNothing();
	const [task] = await db
		.select(taskColumns)
		.from(tasks)
		.where(taskInProject(spaceId, projectId, input.id))
		.limit(1);
	return task ?? 'conflict';
}

/** Modifie n'importe quelle tâche du chantier, y compris son étape (dans le même chantier) et la personne attribuée. */
export async function updateProjectTask(
	db: Db,
	spaceId: SpaceId,
	projectId: string,
	taskId: string,
	patch: TaskWrite,
	now = Date.now()
): Promise<Task | 'not-found' | 'invalid-assignee'> {
	if (!(await getProjectRow(db, spaceId, projectId))) return 'not-found';
	if (patch.stageId && !(await getStage(db, spaceId, projectId, patch.stageId))) return 'not-found';
	if (patch.profileId && !canBeAssigned(spaceId, patch.profileId)) return 'invalid-assignee';
	return (await updateTaskWhere(db, taskInProject(spaceId, projectId, taskId), patch, now)) ?? 'not-found';
}

export async function deleteProjectTask(db: Db, spaceId: SpaceId, projectId: string, taskId: string) {
	if (!(await getProjectRow(db, spaceId, projectId))) return false;
	const deleted = await db
		.delete(tasks)
		.where(taskInProject(spaceId, projectId, taskId))
		.returning({ id: tasks.id });
	return deleted.length > 0;
}
