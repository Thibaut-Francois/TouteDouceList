import { QUERY_MAX } from '$lib/filters';
import { requireScope } from '$lib/server/auth';
import { listArchive } from '$lib/server/repo/tasks';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const scope = await requireScope(event, event.params.profile, { onLocked: 'redirect' });
	const query = (event.url.searchParams.get('q') ?? '').slice(0, QUERY_MAX);
	return { query, page: await listArchive(event.locals.db, scope, { query }) };
};
