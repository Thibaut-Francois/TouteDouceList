import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { createStage } from '$lib/server/repo/projects';
import { parseStageInput, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

/** Nouvelle étape, ajoutée à la fin. */
export const POST: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const input = parseStageInput(await readJson(event.request));
	const stage = await createStage(event.locals.db, spaceId, event.params.id, input);
	if (!stage) error(404, 'Chantier introuvable');
	return json(stage, { status: 201 });
};
