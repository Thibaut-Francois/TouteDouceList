import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { deleteProjectTask, updateProjectTask } from '$lib/server/repo/projects';
import { parseProjectTaskPatch, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const patch = parseProjectTaskPatch(await readJson(event.request));
	const { id, taskId } = event.params;
	const task = await updateProjectTask(event.locals.db, spaceId, id, taskId, patch);
	if (task === 'not-found') error(404, 'Tâche introuvable');
	if (task === 'invalid-assignee') error(400, 'Champ invalide : profileId');
	return json(task);
};

export const DELETE: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const { id, taskId } = event.params;
	if (!(await deleteProjectTask(event.locals.db, spaceId, id, taskId))) error(404, 'Tâche introuvable');
	return new Response(null, { status: 204 });
};
