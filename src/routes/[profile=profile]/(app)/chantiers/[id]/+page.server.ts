import { error } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { getProject } from '$lib/server/repo/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile, { onLocked: 'redirect' });
	const project = await getProject(event.locals.db, spaceId, event.params.id);
	if (!project) error(404, 'Chantier introuvable');
	return { project };
};
