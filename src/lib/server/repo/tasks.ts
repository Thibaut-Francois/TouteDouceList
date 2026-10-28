import { and, asc, desc, eq, getTableColumns, lt, or, sql, type SQL } from 'drizzle-orm';
import type { Scope } from '$lib/spaces';
import { searchText, searchWords } from '$lib/text';
import type { Db } from '../db/client';
import { tasks } from '../db/schema';

// Toutes les fonctions filtrent sur space_id et profile_id : une tâche d'un autre espace,
// ou d'un autre profil du même espace, est introuvable.

// La colonne search ne sert qu'aux requêtes : elle n'est jamais renvoyée au client.
const { search: _search, ...columns } = getTableColumns(tasks);
export { columns as taskColumns };

export type Task = Omit<typeof tasks.$inferSelect, 'search'>;
export type NewTaskInput = Pick<Task, 'id' | 'title' | 'notes' | 'priority' | 'dueDate'>;
export type TaskPatch = Partial<Pick<Task, 'title' | 'notes' | 'priority' | 'dueDate' | 'status'>>;

const ofScope = ({ spaceId, profileId }: Scope) =>
	and(eq(tasks.spaceId, spaceId), eq(tasks.profileId, profileId));
const inScope = (scope: Scope, id: string) => and(ofScope(scope), eq(tasks.id, id));

export function listOpenTasks(db: Db, scope: Scope): Promise<Task[]> {
	return db
		.select(columns)
		.from(tasks)
		.where(and(ofScope(scope), eq(tasks.status, 'open')))
		.orderBy(asc(tasks.createdAt));
}

export async function getTask(db: Db, scope: Scope, id: string): Promise<Task | undefined> {
	const [task] = await db.select(columns).from(tasks).where(inScope(scope, id)).limit(1);
	return task;
}

/**
 * Idempotent : renvoyer la même création renvoie la tâche existante.
 * Renvoie undefined si l'id est déjà pris dans un autre espace ou un autre profil.
 */
export async function createTask(db: Db, scope: Scope, input: NewTaskInput, now = Date.now()) {
	await db
		.insert(tasks)
		.values({
			...input,
			spaceId: scope.spaceId,
			profileId: scope.profileId,
			status: 'open',
			createdAt: now,
			search: searchText(input.title, input.notes)
		})
		.onConflictDoNothing();
	return getTask(db, scope, input.id);
}

export function updateTask(db: Db, scope: Scope, id: string, patch: TaskPatch, now = Date.now()) {
	return updateTaskWhere(db, inScope(scope, id), patch, now);
}

/** Modification d'une tâche de chantier : on peut aussi changer d'étape ou de personne attribuée. */
export type TaskWrite = TaskPatch & Partial<Pick<Task, 'stageId' | 'profileId'>>;

/**
 * Modifie la tâche que désigne where (qui doit garantir l'espace, et le profil ou le chantier).
 * Tient à jour la date de fin et la colonne de recherche.
 */
export async function updateTaskWhere(
	db: Db,
	where: SQL | undefined,
	patch: TaskWrite,
	now = Date.now()
): Promise<Task | undefined> {
	const values: Partial<typeof tasks.$inferInsert> = { ...patch };
	if (patch.status === 'done') values.completedAt = now;
	if (patch.status === 'open') values.completedAt = null;
	const select = () => db.select(columns).from(tasks).where(where).limit(1);
	if (Object.keys(values).length === 0) return (await select())[0];

	if (patch.title !== undefined || patch.notes !== undefined) {
		const [current] = await select();
		if (!current) return undefined;
		values.search = searchText(patch.title ?? current.title, patch.notes ?? current.notes);
	}

	const [task] = await db.update(tasks).set(values).where(where).returning(columns);
	return task;
}

export async function deleteTask(db: Db, scope: Scope, id: string) {
	const deleted = await db.delete(tasks).where(inScope(scope, id)).returning({ id: tasks.id });
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
	scope: Scope,
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
		.where(and(ofScope(scope), eq(tasks.status, 'done'), after, ...words))
		.orderBy(desc(tasks.completedAt), desc(tasks.id))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	const last = page.at(-1);
	return {
		tasks: page,
		next: rows.length > limit && last ? { completedAt: last.completedAt!, id: last.id } : null
	};
}
