import { requireScope } from '$lib/server/auth';
import { listProjects } from '$lib/server/repo/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile, { onLocked: 'redirect' });
	return { projects: await listProjects(event.locals.db, spaceId) };
};
