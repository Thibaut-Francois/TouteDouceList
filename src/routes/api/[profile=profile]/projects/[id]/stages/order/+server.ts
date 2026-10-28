import { error } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { reorderStages } from '$lib/server/repo/projects';
import { parseStageOrder, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

/** Nouvel ordre : la liste complète des ids d'étapes du chantier, ni plus ni moins. */
export const PUT: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const ids = parseStageOrder(await readJson(event.request));
	const result = await reorderStages(event.locals.db, spaceId, event.params.id, ids);
	if (result === 'not-found') error(404, 'Chantier introuvable');
	if (result === 'invalid') error(400, 'Ordre invalide : il faut toutes les étapes du chantier, une seule fois');
	return new Response(null, { status: 204 });
};
