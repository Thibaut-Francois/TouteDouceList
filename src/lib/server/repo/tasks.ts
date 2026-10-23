import { and, asc, eq } from 'drizzle-orm';
import type { SpaceId } from '$lib/spaces';
import type { Db } from '../db/client';
import { tasks } from '../db/schema';

// Toutes les fonctions filtrent sur space_id : une tâche d'un autre espace est introuvable.

export type Task = typeof tasks.$inferSelect;
export type NewTaskInput = Pick<Task, 'id' | 'title' | 'notes' | 'priority' | 'dueDate'>;
export type TaskPatch = Partial<Pick<Task, 'title' | 'notes' | 'priority' | 'dueDate' | 'status'>>;

const inSpace = (spaceId: SpaceId, id: string) => and(eq(tasks.spaceId, spaceId), eq(tasks.id, id));

export function listOpenTasks(db: Db, spaceId: SpaceId) {
	return db
		.select()
		.from(tasks)
		.where(and(eq(tasks.spaceId, spaceId), eq(tasks.status, 'open')))
		.orderBy(asc(tasks.createdAt));
}

export async function getTask(db: Db, spaceId: SpaceId, id: string): Promise<Task | undefined> {
	const [task] = await db.select().from(tasks).where(inSpace(spaceId, id)).limit(1);
	return task;
}

/**
 * Idempotent : renvoyer la même création renvoie la tâche existante.
 * Renvoie undefined si l'id est déjà pris dans un autre espace.
 */
export async function createTask(db: Db, spaceId: SpaceId, input: NewTaskInput, now = Date.now()) {
	await db
		.insert(tasks)
		.values({ ...input, spaceId, status: 'open', createdAt: now })
		.onConflictDoNothing();
	return getTask(db, spaceId, input.id);
}

export async function updateTask(
	db: Db,
	spaceId: SpaceId,
	id: string,
	patch: TaskPatch,
	now = Date.now()
): Promise<Task | undefined> {
	const values: Partial<Task> = { ...patch };
	if (patch.status === 'done') values.completedAt = now;
	if (patch.status === 'open') values.completedAt = null;
	if (Object.keys(values).length === 0) return getTask(db, spaceId, id);

	const [task] = await db.update(tasks).set(values).where(inSpace(spaceId, id)).returning();
	return task;
}

export async function deleteTask(db: Db, spaceId: SpaceId, id: string) {
	const deleted = await db.delete(tasks).where(inSpace(spaceId, id)).returning({ id: tasks.id });
	return deleted.length > 0;
}
