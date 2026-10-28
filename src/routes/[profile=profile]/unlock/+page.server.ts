import { error, fail, redirect } from '@sveltejs/kit';
import {
	attemptUnlock,
	clearSessionCookie,
	cookieName,
	deleteSession,
	isUnlocked,
	setSessionCookie
} from '$lib/server/auth';
import { isProfileId, isProtected, PROFILE_SPACE } from '$lib/spaces';
import type { Actions, PageServerLoad } from './$types';

/** Seul le profil d'un espace protégé a une page de déverrouillage ; les autres y sont renvoyés directement. */
function protectedProfile(profile: string) {
	if (!isProfileId(profile)) error(404, 'Profil inconnu');
	const space = PROFILE_SPACE[profile];
	if (!isProtected(space)) redirect(303, `/${profile}`);
	return { profile, space };
}

export const load: PageServerLoad = async (event) => {
	const { profile, space } = protectedProfile(event.params.profile);
	if (await isUnlocked(event, space)) redirect(303, `/${profile}`);
	return { profile, space };
};

export const actions: Actions = {
	unlock: async (event) => {
		const { profile, space } = protectedProfile(event.params.profile);

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
		redirect(303, `/${profile}`);
	},

	lock: async (event) => {
		const { space } = protectedProfile(event.params.profile);

		const token = event.cookies.get(cookieName(space));
		if (token) await deleteSession(event.locals.db, token);
		clearSessionCookie(event.cookies, space);
		// Retour au dernier profil Pro (route /pro).
		redirect(303, '/pro');
	}
};
