import { requireSpace } from '$lib/server/auth';
import { isProtected } from '$lib/spaces';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const space = await requireSpace(event, event.params.space, { onLocked: 'redirect' });
	return { space, lockable: isProtected(space) };
};
