import { requireSpace } from '$lib/server/auth';
import { rememberSpace } from '$lib/server/last-space';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const space = await requireSpace(event, event.params.space, { onLocked: 'redirect' });
	rememberSpace(event.cookies, space);
	return { space };
};
