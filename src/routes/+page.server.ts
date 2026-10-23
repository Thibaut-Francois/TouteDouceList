import { redirect } from '@sveltejs/kit';
import { LAST_SPACE_COOKIE } from '$lib/server/last-space';
import { isSpaceId } from '$lib/spaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ cookies }) => {
	const last = cookies.get(LAST_SPACE_COOKIE);
	redirect(307, `/${isSpaceId(last) ? last : 'perso'}`);
};
