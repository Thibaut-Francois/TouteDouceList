import { error, json } from '@sveltejs/kit';
import { requireSpace } from '$lib/server/auth';
import { createTask, listOpenTasks } from '$lib/server/repo/tasks';
import { parseNewTask, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const space = await requireSpace(event, event.params.space);
	return json(await listOpenTasks(event.locals.db, space));
};

export const POST: RequestHandler = async (event) => {
	const space = await requireSpace(event, event.params.space);
	const input = parseNewTask(await readJson(event.request));
	const task = await createTask(event.locals.db, space, input);
	if (!task) error(409, 'Identifiant déjà utilisé');
	return json(task, { status: 201 });
};
