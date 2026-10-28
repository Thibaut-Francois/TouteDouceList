import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { deleteStage, updateStage, type StageDeletion } from '$lib/server/repo/projects';
import { parseStagePatch, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const patch = parseStagePatch(await readJson(event.request));
	const stage = await updateStage(event.locals.db, spaceId, event.params.id, event.params.stageId, patch);
	if (!stage) error(404, 'Étape introuvable');
	if (stage === 'invalid') error(400, 'La date de début doit précéder la date de fin');
	return json(stage);
};

/**
 * ?moveTo=<étape> : ses tâches passent dans une autre étape du chantier.
 * ?tasks=delete : ses tâches ouvertes sont supprimées (les faites restent dans l'archive).
 * Sans choix, refusée (409) si l'étape a des tâches ouvertes.
 */
export const DELETE: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const params = event.url.searchParams;
	const moveTo = params.get('moveTo');
	const choice: StageDeletion = moveTo
		? { moveTo }
		: params.get('tasks') === 'delete'
			? { deleteOpen: true }
			: {};
	const result = await deleteStage(event.locals.db, spaceId, event.params.id, event.params.stageId, choice);
	if (result === 'not-found') error(404, 'Étape introuvable');
	if (result === 'invalid-target') error(400, 'Étape de destination invalide');
	if (result === 'needs-choice') error(409, 'Étape avec des tâches ouvertes : les déplacer ou les supprimer');
	return new Response(null, { status: 204 });
};
