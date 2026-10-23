import type { SpaceId } from './spaces';

/** Cache des pages et données consultées en ligne, relues hors ligne (lecture seule). */
export const PAGES_CACHE = 'tdl-pages';

const SPACE_PAGE = /^\/(pro|perso)(\/(?!unlock)|$)/;

/** Pages d'espace (et leurs données) que le service worker conserve ; jamais l'API ni le déverrouillage. */
export function isCachablePage(pathname: string) {
	const path = pathname.replace(/\/__data\.json$/, '') || '/';
	return SPACE_PAGE.test(path);
}

/** Oublie les pages hors ligne d'un espace (verrouillage, session expirée). */
export async function forgetOfflinePages(space: SpaceId) {
	if (typeof caches === 'undefined') return;
	const cache = await caches.open(PAGES_CACHE);
	for (const request of await cache.keys()) {
		const path = new URL(request.url).pathname;
		if (path === `/${space}` || path.startsWith(`/${space}/`)) await cache.delete(request);
	}
}
