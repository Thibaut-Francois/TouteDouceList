import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { createTask, listOpenTasks } from '$lib/server/repo/tasks';
import { parseNewTask, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	return json(await listOpenTasks(event.locals.db, scope));
};

export const POST: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const input = parseNewTask(await readJson(event.request));
	const task = await createTask(event.locals.db, scope, input);
	if (!task) error(409, 'Identifiant déjà utilisé');
	return json(task, { status: 201 });
};
