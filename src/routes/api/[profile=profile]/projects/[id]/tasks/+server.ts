import { error, json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { createProjectTask } from '$lib/server/repo/projects';
import { parseProjectTask, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

/** Tâche dans une étape, attribuée à un profil de l'espace (Thibaut ou Philippe ; Perso dans Perso). */
export const POST: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const input = parseProjectTask(await readJson(event.request));
	const task = await createProjectTask(event.locals.db, spaceId, event.params.id, input);
	if (task === 'not-found') error(404, 'Chantier ou étape introuvable');
	if (task === 'invalid-assignee') error(400, 'Champ invalide : profileId');
	if (task === 'conflict') error(409, 'Identifiant déjà utilisé');
	return json(task, { status: 201 });
};
