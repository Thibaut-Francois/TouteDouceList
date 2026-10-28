import { error, json } from '@sveltejs/kit';
import { todayInParis } from '$lib/dates';
import { requireScope } from '$lib/server/auth';
import { deleteRecurrence, getRecurrence, updateRecurrence } from '$lib/server/repo/recurrences';
import { parseRecurrencePatch, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const recurrence = await getRecurrence(event.locals.db, scope, event.params.id);
	if (!recurrence) error(404, 'Récurrence introuvable');
	return json(recurrence);
};

export const PATCH: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const patch = parseRecurrencePatch(await readJson(event.request));
	const recurrence = await updateRecurrence(event.locals.db, scope, event.params.id, patch, todayInParis());
	if (!recurrence) error(404, 'Récurrence introuvable');
	return json(recurrence);
};

/** ?occurrences=keep conserve les occurrences ouvertes ; par défaut elles sont supprimées. */
export const DELETE: RequestHandler = async (event) => {
	const scope = await requireScope(event, event.params.profile);
	const keepOpen = event.url.searchParams.get('occurrences') === 'keep';
	if (!(await deleteRecurrence(event.locals.db, scope, event.params.id, { keepOpen }))) {
		error(404, 'Récurrence introuvable');
	}
	return new Response(null, { status: 204 });
};
