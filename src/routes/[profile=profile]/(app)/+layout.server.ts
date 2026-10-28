import { requireScope } from '$lib/server/auth';
import { rememberProfile } from '$lib/server/last-profile';
import { isProtected } from '$lib/spaces';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { spaceId, profileId } = await requireScope(event, event.params.profile, { onLocked: 'redirect' });
	rememberProfile(event.cookies, profileId);
	return { space: spaceId, profile: profileId, lockable: isProtected(spaceId) };
};
