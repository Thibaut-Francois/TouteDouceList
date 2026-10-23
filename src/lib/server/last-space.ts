import type { Cookies } from '@sveltejs/kit';
import type { SpaceId } from '$lib/spaces';

/** Dernier espace ouvert, pour que « / » (et l'icône de la PWA) y mène directement. */
export const LAST_SPACE_COOKIE = 'tdl_last';

export function rememberSpace(cookies: Cookies, space: SpaceId) {
	if (cookies.get(LAST_SPACE_COOKIE) === space) return;
	cookies.set(LAST_SPACE_COOKIE, space, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 365 * 24 * 60 * 60
	});
}
