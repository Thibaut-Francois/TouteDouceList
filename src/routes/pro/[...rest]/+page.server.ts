import { redirect } from '@sveltejs/kit';
import { lastProProfile } from '$lib/server/last-profile';
import type { PageServerLoad } from './$types';

// Adresses d'avant les profils (/pro, /pro/archive…) : même page, dans le dernier profil Pro.
export const load: PageServerLoad = ({ cookies, params, url }) => {
	const rest = params.rest ? `/${params.rest}` : '';
	redirect(307, `/${lastProProfile(cookies)}${rest}${url.search}`);
};
