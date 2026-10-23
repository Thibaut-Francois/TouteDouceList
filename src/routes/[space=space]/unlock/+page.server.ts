import { error, fail, redirect } from '@sveltejs/kit';
import {
	attemptUnlock,
	clearSessionCookie,
	cookieName,
	deleteSession,
	isUnlocked,
	setSessionCookie
} from '$lib/server/auth';
import { isProtected, isSpaceId, type SpaceId } from '$lib/spaces';
import type { Actions, PageServerLoad } from './$types';

/** Seul un espace protégé a une page de déverrouillage ; les autres y sont renvoyés directement. */
function protectedSpace(space: string): SpaceId {
	if (!isSpaceId(space)) error(404, 'Espace inconnu');
	if (!isProtected(space)) redirect(303, `/${space}`);
	return space;
}

export const load: PageServerLoad = async (event) => {
	const space = protectedSpace(event.params.space);
	if (await isUnlocked(event, space)) redirect(303, `/${space}`);
	return { space };
};

export const actions: Actions = {
	unlock: async (event) => {
		const space = protectedSpace(event.params.space);

		const code = (await event.request.formData()).get('code');
		if (typeof code !== 'string' || code.trim().length === 0) {
			return fail(400, { error: 'Code requis.' });
		}

		const result = await attemptUnlock(event.locals.db, space, code, event.getClientAddress());
		if (!result.ok) {
			return result.reason === 'rate_limited'
				? fail(429, { error: 'Trop de tentatives. Réessaie dans 15 minutes.' })
				: fail(400, { error: 'Code incorrect.' });
		}

		setSessionCookie(event.cookies, space, result.token);
		redirect(303, `/${space}`);
	},

	lock: async (event) => {
		const space = protectedSpace(event.params.space);

		const token = event.cookies.get(cookieName(space));
		if (token) await deleteSession(event.locals.db, token);
		clearSessionCookie(event.cookies, space);
		redirect(303, `/${space}/unlock`);
	}
};
