import { error, fail, redirect } from '@sveltejs/kit';
import {
	attemptUnlock,
	clearSessionCookie,
	cookieName,
	deleteSession,
	isUnlocked,
	setSessionCookie
} from '$lib/server/auth';
import { isSpaceId } from '$lib/spaces';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { space } = event.params;
	if (!isSpaceId(space)) error(404, 'Espace inconnu');
	if (await isUnlocked(event, space)) redirect(303, `/${space}`);
	return { space };
};

export const actions: Actions = {
	unlock: async (event) => {
		const { space } = event.params;
		if (!isSpaceId(space)) error(404, 'Espace inconnu');

		const password = (await event.request.formData()).get('password');
		if (typeof password !== 'string' || password.length === 0) {
			return fail(400, { error: 'Mot de passe requis.' });
		}

		const result = await attemptUnlock(event.locals.db, space, password, event.getClientAddress());
		if (!result.ok) {
			return result.reason === 'rate_limited'
				? fail(429, { error: 'Trop de tentatives. Réessaie dans 15 minutes.' })
				: fail(400, { error: 'Mot de passe incorrect.' });
		}

		setSessionCookie(event.cookies, space, result.token);
		redirect(303, `/${space}`);
	},

	lock: async (event) => {
		const { space } = event.params;
		if (!isSpaceId(space)) error(404, 'Espace inconnu');

		const token = event.cookies.get(cookieName(space));
		if (token) await deleteSession(event.locals.db, token);
		clearSessionCookie(event.cookies, space);
		redirect(303, `/${space}/unlock`);
	}
};
