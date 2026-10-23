import { requireSpace } from '$lib/server/auth';
import { listRecurrences } from '$lib/server/repo/recurrences';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const space = await requireSpace(event, event.params.space, { onLocked: 'redirect' });
	return { recurrences: await listRecurrences(event.locals.db, space) };
};
