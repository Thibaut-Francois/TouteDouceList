import type { Db } from '$lib/server/db/client';
import type { SpaceId } from '$lib/spaces';

declare global {
	namespace App {
		interface Locals {
			db: Db;
			/** Cache, pour la durée de la requête, des sessions déjà vérifiées. */
			unlocked: Partial<Record<SpaceId, boolean>>;
		}
	}
}

export {};
