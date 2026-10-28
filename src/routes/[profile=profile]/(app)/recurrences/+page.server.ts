import { requireScope } from '$lib/server/auth';
import { listRecurrences } from '$lib/server/repo/recurrences';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const scope = await requireScope(event, event.params.profile, { onLocked: 'redirect' });
	return { recurrences: await listRecurrences(event.locals.db, scope) };
};
