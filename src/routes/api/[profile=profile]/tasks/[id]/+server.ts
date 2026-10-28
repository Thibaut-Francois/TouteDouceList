import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { deleteTask, getTask, updateTask } from '$lib/server/repo/tasks';
import { parseTaskPatch, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const task = await getTask(event.locals.db, scope, event.params.id);
	if (!task) error(404, 'Tâche introuvable');
	return json(task);
};

export const PATCH: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const patch = parseTaskPatch(await readJson(event.request));
	const task = await updateTask(event.locals.db, scope, event.params.id, patch);
	if (!task) error(404, 'Tâche introuvable');
	return json(task);
};

export const DELETE: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	if (!(await deleteTask(event.locals.db, scope, event.params.id))) error(404, 'Tâche introuvable');
	return new Response(null, { status: 204 });
};
