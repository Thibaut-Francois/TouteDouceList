import { todayInParis } from '$lib/dates';
import { requireScope } from '$lib/server/auth';
import { generateDueOccurrences } from '$lib/server/recurrence/generate';
import { listOpenTasks } from '$lib/server/repo/tasks';
import { readView } from '$lib/view-cookie';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Les loads de layout et de page tournent en parallèle : chaque load vérifie lui-même l'accès.
	const scope = await requireScope(event, event.params.profile, { onLocked: 'redirect' });
	await generateDueOccurrences(event.locals.db, scope, todayInParis());
	return {
		tasks: await listOpenTasks(event.locals.db, scope),
		view: readView(event.cookies, scope.profileId)
	};
};
