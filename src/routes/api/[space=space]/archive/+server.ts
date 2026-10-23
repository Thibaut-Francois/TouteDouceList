import { json } from '@sveltejs/kit';
import { QUERY_MAX } from '$lib/filters';
import { requireSpace } from '$lib/server/auth';
import { listArchive } from '$lib/server/repo/tasks';
import { parseArchiveCursor } from '$lib/server/validate';
import type { RequestHandler } from './$types';

/** ?q=recherche&after=<curseur> : page suivante de l'archive. */
export const GET: RequestHandler = async (event) => {
	const space = await requireSpace(event, event.params.space);
	const query = (event.url.searchParams.get('q') ?? '').slice(0, QUERY_MAX);
	const cursor = parseArchiveCursor(event.url.searchParams.get('after'));
	return json(await listArchive(event.locals.db, space, { query, cursor }));
};
