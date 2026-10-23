import { json } from '@sveltejs/kit';
import { requireSpace } from '$lib/server/auth';
import { createRecurrence, listRecurrences } from '$lib/server/repo/recurrences';
import { parseRecurrenceInput, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const space = await requireSpace(event, event.params.space);
	return json(await listRecurrences(event.locals.db, space));
};

export const POST: RequestHandler = async (event) => {
	const space = await requireSpace(event, event.params.space);
	const input = parseRecurrenceInput(await readJson(event.request));
	return json(await createRecurrence(event.locals.db, space, input), { status: 201 });
};
