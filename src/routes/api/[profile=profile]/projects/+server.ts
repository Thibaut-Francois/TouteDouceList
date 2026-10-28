import { json } from '@sveltejs/kit';
import { requireScope } from '$lib/server/auth';
import { createProject, listProjects } from '$lib/server/repo/projects';
import { parseProjectInput, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

// Chantiers de l'espace du profil (communs à ses profils). ?status=done : les chantiers terminés.
export const GET: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const status = event.url.searchParams.get('status') === 'done' ? 'done' : 'open';
	return json(await listProjects(event.locals.db, spaceId, status));
};

export const POST: RequestHandler = async (event) => {
	const { spaceId } = await requireScope(event, event.params.profile);
	const input = parseProjectInput(await readJson(event.request));
	return json(await createProject(event.locals.db, spaceId, input), { status: 201 });
};
