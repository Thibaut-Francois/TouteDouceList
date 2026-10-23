import { and, asc, count, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { addDays } from '$lib/dates';
import { presetToRrule, sanitizePreset, type Preset } from '$lib/recurrence/presets';
import type { SpaceId } from '$lib/spaces';
import { searchText } from '$lib/text';
import type { Db } from '../db/client';
import { recurrences, tasks } from '../db/schema';

// Comme pour les tâches, toutes les fonctions filtrent sur space_id.

type Row = typeof recurrences.$inferSelect;

export type Recurrence = Omit<Row, 'preset' | 'deletedAt'> & { preset: Preset; openCount: number };

export type RecurrenceInput = {
	title: string;
	notes: string;
	priority: number;
	preset: Preset;
	startDate: string;
};

export type RecurrencePatch = Partial<RecurrenceInput & { active: boolean }>;

const inSpace = (spaceId: SpaceId, id: string) =>
	and(eq(recurrences.spaceId, spaceId), eq(recurrences.id, id), isNull(recurrences.deletedAt));

const openOccurrences = (spaceId: SpaceId, id: string) =>
	and(eq(tasks.spaceId, spaceId), eq(tasks.recurrenceId, id), eq(tasks.status, 'open'));

function toRecurrence({ preset, deletedAt: _, ...row }: Row, openCount: number): Recurrence {
	// Le préréglage est écrit par le serveur ; un JSON illisible retomberait sur la règle stockée.
	return { ...row, preset: sanitizePreset(JSON.parse(preset)) ?? { kind: 'daily' }, openCount };
}

export async function listRecurrences(db: Db, spaceId: SpaceId): Promise<Recurrence[]> {
	const rows = await db
		.select({ recurrence: recurrences, openCount: count(tasks.id) })
		.from(recurrences)
		.leftJoin(tasks, and(eq(tasks.recurrenceId, recurrences.id), eq(tasks.status, 'open')))
		.where(and(eq(recurrences.spaceId, spaceId), isNull(recurrences.deletedAt)))
		.groupBy(recurrences.id)
		.orderBy(asc(sql`lower(${recurrences.title})`));
	return rows.map((r) => toRecurrence(r.recurrence, r.openCount));
}

export async function getRecurrence(db: Db, spaceId: SpaceId, id: string): Promise<Recurrence | undefined> {
	const [row] = await db.select().from(recurrences).where(inSpace(spaceId, id)).limit(1);
	if (!row) return undefined;
	const [{ n }] = await db.select({ n: count() }).from(tasks).where(openOccurrences(spaceId, id));
	return toRecurrence(row, n);
}

export async function createRecurrence(db: Db, spaceId: SpaceId, input: RecurrenceInput) {
	const id = randomUUID();
	await db.insert(recurrences).values({
		id,
		spaceId,
		title: input.title,
		notes: input.notes,
		priority: input.priority,
		preset: JSON.stringify(input.preset),
		rrule: presetToRrule(input.preset),
		startDate: input.startDate
	});
	return (await getRecurrence(db, spaceId, id))!;
}

/**
 * Titre, notes et priorité sont reportés sur les occurrences ouvertes ; les terminées ne changent jamais.
 * Une nouvelle règle ne vaut que pour les dates pas encore générées.
 * À la reprise après une pause, les dates de la pause ne sont pas rattrapées.
 */
export async function updateRecurrence(
	db: Db,
	spaceId: SpaceId,
	id: string,
	patch: RecurrencePatch,
	today: string
): Promise<Recurrence | undefined> {
	const current = await getRecurrence(db, spaceId, id);
	if (!current) return undefined;

	const { preset, ...rest } = patch;
	const values: Partial<Row> = { ...rest };
	if (preset) {
		values.preset = JSON.stringify(preset);
		values.rrule = presetToRrule(preset);
	}
	if (patch.active === true && !current.active) {
		const yesterday = addDays(today, -1);
		if (!current.lastGeneratedDate || current.lastGeneratedDate < yesterday) {
			values.lastGeneratedDate = yesterday;
		}
	}
	if (Object.keys(values).length > 0) {
		await db.update(recurrences).set(values).where(inSpace(spaceId, id));
	}

	const shared = Object.fromEntries(
		(['title', 'notes', 'priority'] as const).filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]])
	);
	if (patch.title !== undefined || patch.notes !== undefined) {
		// La colonne search dépend du titre et des notes de chaque occurrence.
		const open = await db
			.select({ id: tasks.id, title: tasks.title, notes: tasks.notes })
			.from(tasks)
			.where(openOccurrences(spaceId, id));
		for (const occurrence of open) {
			const title = patch.title ?? occurrence.title;
			const notes = patch.notes ?? occurrence.notes;
			await db
				.update(tasks)
				.set({ ...shared, search: searchText(title, notes) })
				.where(and(openOccurrences(spaceId, id), eq(tasks.id, occurrence.id)));
		}
	} else if (Object.keys(shared).length > 0) {
		await db.update(tasks).set(shared).where(openOccurrences(spaceId, id));
	}

	return getRecurrence(db, spaceId, id);
}

/**
 * Suppression logique : la génération s'arrête et les occurrences terminées gardent leur lien.
 * Les occurrences ouvertes sont supprimées, sauf si keepOpen.
 */
export async function deleteRecurrence(
	db: Db,
	spaceId: SpaceId,
	id: string,
	{ keepOpen = false }: { keepOpen?: boolean } = {},
	now = Date.now()
) {
	const deleted = await db
		.update(recurrences)
		.set({ deletedAt: now, active: false })
		.where(inSpace(spaceId, id))
		.returning({ id: recurrences.id });
	if (deleted.length === 0) return false;
	if (!keepOpen) await db.delete(tasks).where(openOccurrences(spaceId, id));
	return true;
}

/** Récurrences dont des occurrences peuvent être dues : actives, non supprimées, pas encore générées jusqu'à today. */
export function dueRecurrences(db: Db, spaceId: SpaceId, today: string) {
	return db
		.select()
		.from(recurrences)
		.where(
			and(
				eq(recurrences.spaceId, spaceId),
				eq(recurrences.active, true),
				isNull(recurrences.deletedAt),
				or(isNull(recurrences.lastGeneratedDate), lt(recurrences.lastGeneratedDate, today))
			)
		);
}
