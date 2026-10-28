import { json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { createRecurrence, listRecurrences } from '$lib/server/repo/recurrences';
import { parseRecurrenceInput, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	return json(await listRecurrences(event.locals.db, scope));
};

export const POST: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const input = parseRecurrenceInput(await readJson(event.request));
	return json(await createRecurrence(event.locals.db, scope, input), { status: 201 });
};
