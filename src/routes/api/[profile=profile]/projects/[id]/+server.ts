import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { deleteProject, getProject, updateProject } from '$lib/server/repo/projects';
import { parseProjectPatch, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const project = await getProject(event.locals.db, spaceId, event.params.id);
	if (!project) error(404, 'Chantier introuvable');
	return json(project);
};

export const PATCH: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const patch = parseProjectPatch(await readJson(event.request));
	const project = await updateProject(event.locals.db, spaceId, event.params.id, patch);
	if (!project) error(404, 'Chantier introuvable');
	return json(project);
};

/** Suppression définitive : le chantier, ses étapes et leurs tâches. */
export const DELETE: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	if (!(await deleteProject(event.locals.db, spaceId, event.params.id))) error(404, 'Chantier introuvable');
	return new Response(null, { status: 204 });
};
