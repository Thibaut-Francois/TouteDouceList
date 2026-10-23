import { and, asc, desc, eq, getTableColumns, lt, or, sql } from 'drizzle-orm';
import type { SpaceId } from '$lib/spaces';
import { searchText, searchWords } from '$lib/text';
import type { Db } from '../db/client';
import { tasks } from '../db/schema';

// Toutes les fonctions filtrent sur space_id : une tâche d'un autre espace est introuvable.

// La colonne search ne sert qu'aux requêtes : elle n'est jamais renvoyée au client.
const { search: _search, ...columns } = getTableColumns(tasks);

export type Task = Omit<typeof tasks.$inferSelect, 'search'>;
export type NewTaskInput = Pick<Task, 'id' | 'title' | 'notes' | 'priority' | 'dueDate'>;
export type TaskPatch = Partial<Pick<Task, 'title' | 'notes' | 'priority' | 'dueDate' | 'status'>>;

const inSpace = (spaceId: SpaceId, id: string) => and(eq(tasks.spaceId, spaceId), eq(tasks.id, id));

export function listOpenTasks(db: Db, spaceId: SpaceId): Promise<Task[]> {
	return db
		.select(columns)
		.from(tasks)
		.where(and(eq(tasks.spaceId, spaceId), eq(tasks.status, 'open')))
		.orderBy(asc(tasks.createdAt));
}

export async function getTask(db: Db, spaceId: SpaceId, id: string): Promise<Task | undefined> {
	const [task] = await db.select(columns).from(tasks).where(inSpace(spaceId, id)).limit(1);
	return task;
}

/**
 * Idempotent : renvoyer la même création renvoie la tâche existante.
 * Renvoie undefined si l'id est déjà pris dans un autre espace.
 */
export async function createTask(db: Db, spaceId: SpaceId, input: NewTaskInput, now = Date.now()) {
	await db
		.insert(tasks)
		.values({
			...input,
			spaceId,
			status: 'open',
			createdAt: now,
			search: searchText(input.title, input.notes)
		})
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
	const values: Partial<typeof tasks.$inferInsert> = { ...patch };
	if (patch.status === 'done') values.completedAt = now;
	if (patch.status === 'open') values.completedAt = null;
	if (Object.keys(values).length === 0) return getTask(db, spaceId, id);

	if (patch.title !== undefined || patch.notes !== undefined) {
		const current = await getTask(db, spaceId, id);
		if (!current) return undefined;
		values.search = searchText(patch.title ?? current.title, patch.notes ?? current.notes);
	}

	const [task] = await db.update(tasks).set(values).where(inSpace(spaceId, id)).returning(columns);
	return task;
}

export async function deleteTask(db: Db, spaceId: SpaceId, id: string) {
	const deleted = await db.delete(tasks).where(inSpace(spaceId, id)).returning({ id: tasks.id });
	return deleted.length > 0;
}

// --- Archive ---

export const ARCHIVE_PAGE_SIZE = 50;

/** Position dans l'archive (pagination par curseur, stable même si des tâches sont ajoutées entre deux pages). */
export type ArchiveCursor = { completedAt: number; id: string };

const escapeLike = (word: string) => word.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Tâches terminées, de la plus récente à la plus ancienne ; tous les mots de la recherche sont requis. */
export async function listArchive(
	db: Db,
	spaceId: SpaceId,
	{ query = '', cursor, limit = ARCHIVE_PAGE_SIZE }: { query?: string; cursor?: ArchiveCursor; limit?: number } = {}
): Promise<{ tasks: Task[]; next: ArchiveCursor | null }> {
	const words = searchWords(query).map((w) => sql`${tasks.search} LIKE ${`%${escapeLike(w)}%`} ESCAPE '\\'`);
	const after = cursor
		? or(
				lt(tasks.completedAt, cursor.completedAt),
				and(eq(tasks.completedAt, cursor.completedAt), lt(tasks.id, cursor.id))
			)
		: undefined;

	const rows = await db
		.select(columns)
		.from(tasks)
		.where(and(eq(tasks.spaceId, spaceId), eq(tasks.status, 'done'), after, ...words))
		.orderBy(desc(tasks.completedAt), desc(tasks.id))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	const last = page.at(-1);
	return {
		tasks: page,
		next: rows.length > limit && last ? { completedAt: last.completedAt!, id: last.id } : null
	};
}
