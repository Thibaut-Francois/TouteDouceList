import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { addDays } from '$lib/dates';
import type { Scope } from '$lib/spaces';
import { searchText } from '$lib/text';
import type { Db } from '../db/client';
import { recurrences, tasks } from '../db/schema';
import { dueRecurrences } from '../repo/recurrences';
import { occurrencesBetween } from './engine';

const CHUNK = 200;

/**
 * Crée les occurrences dues jusqu'à today inclus, rattrapage compris (cumul : les manquées restent en retard).
 * Idempotent : l'unicité (recurrence_id, occurrence_date) empêche tout doublon, même si deux appareils
 * ouvrent le profil en même temps. Les occurrences appartiennent au profil de la récurrence.
 * Renvoie le nombre d'occurrences créées.
 */
export async function generateDueOccurrences(db: Db, scope: Scope, today: string, now = Date.now()) {
	let created = 0;

	for (const r of await dueRecurrences(db, scope, today)) {
		const from = r.lastGeneratedDate ? addDays(r.lastGeneratedDate, 1) : r.startDate;
		const dates = occurrencesBetween(r.rrule, r.startDate, from < r.startDate ? r.startDate : from, today);

		for (let i = 0; i < dates.length; i += CHUNK) {
			const inserted = await db
				.insert(tasks)
				.values(
					dates.slice(i, i + CHUNK).map((date) => ({
						id: randomUUID(),
						spaceId: scope.spaceId,
						profileId: scope.profileId,
						title: r.title,
						notes: r.notes,
						priority: r.priority,
						dueDate: date,
						status: 'open' as const,
						createdAt: now,
						recurrenceId: r.id,
						occurrenceDate: date,
						search: searchText(r.title, r.notes)
					}))
				)
				.onConflictDoNothing()
				.returning({ id: tasks.id });
			created += inserted.length;
		}

		// Avance seulement : une génération concurrente déjà plus loin n'est pas ramenée en arrière.
		await db
			.update(recurrences)
			.set({ lastGeneratedDate: today })
			.where(
				and(
					eq(recurrences.id, r.id),
					or(isNull(recurrences.lastGeneratedDate), lt(recurrences.lastGeneratedDate, today))
				)
			);
	}

	return created;
}
