import { PROFILE_SPACE, PROFILES, profilesOf, type ProfileId, type SpaceId } from './spaces';

/** Cache des pages et données consultées en ligne, relues hors ligne (lecture seule). */
export const PAGES_CACHE = 'tdl-pages';

/** Dans le cache des pages : le dernier profil Pro ouvert, rouvert au lancement hors ligne. */
export const LAST_PROFILE_KEY = '/__last-profile';

const PROFILE_PAGE = new RegExp(`^/(${PROFILES.join('|')})(/(?!unlock)|$)`);

/** Pages de profil (et leurs données) que le service worker conserve ; jamais l'API ni le déverrouillage. */
export function isCachablePage(pathname: string) {
	const path = pathname.replace(/\/__data\.json$/, '') || '/';
	return PROFILE_PAGE.test(path);
}

/** Profil Pro d'une page conservée, pour le mémoriser comme dernier profil ouvert. */
export function proProfileOf(pathname: string): ProfileId | undefined {
	const profile = PROFILE_PAGE.exec(pathname)?.[1] as ProfileId | undefined;
	return profile && PROFILE_SPACE[profile] === 'pro' ? profile : undefined;
}

/** Oublie les pages hors ligne de tous les profils d'un espace (verrouillage, session expirée). */
export async function forgetOfflinePages(space: SpaceId) {
	if (typeof caches === 'undefined') return;
	const cache = await caches.open(PAGES_CACHE);
	const prefixes = profilesOf(space).map((p) => `/${p}`);
	for (const request of await cache.keys()) {
		const path = new URL(request.url).pathname;
		if (prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
			await cache.delete(request);
		}
	}
}
