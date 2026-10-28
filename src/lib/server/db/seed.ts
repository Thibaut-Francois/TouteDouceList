import { and, eq, isNull } from 'drizzle-orm';
import { DEFAULT_PROFILE, PROFILE_NAMES, PROFILE_SPACE, PROFILES, SPACE_NAMES, SPACES } from '$lib/spaces';
import type { Db } from './client';
import { profiles, recurrences, spaces, tasks } from './schema';

/**
 * Crée les espaces et les profils s'ils manquent, puis rattache au profil par défaut de son espace
 * (Pro → Thibaut, Perso → Perso) toute tâche ou récurrence sans profil : données d'avant les profils,
 * ou créées par l'ancienne version pendant un déploiement. Sans effet si tout est déjà en place.
 */
export async function seedReferenceData(db: Db) {
	for (const space of SPACES) {
		await db.insert(spaces).values({ id: space, name: SPACE_NAMES[space] }).onConflictDoNothing();
	}
	for (const profile of PROFILES) {
		await db
			.insert(profiles)
			.values({ id: profile, spaceId: PROFILE_SPACE[profile], name: PROFILE_NAMES[profile] })
			.onConflictDoNothing();
	}

	let attached = 0;
	for (const space of SPACES) {
		const profileId = DEFAULT_PROFILE[space];
		for (const table of [tasks, recurrences]) {
			const rows = await db
				.update(table)
				.set({ profileId })
				.where(and(eq(table.spaceId, space), isNull(table.profileId)))
				.returning({ id: table.id });
			attached += rows.length;
		}
	}
	return { attached };
}
