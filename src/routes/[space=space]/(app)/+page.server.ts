import { requireSpace } from '$lib/server/auth';
import { listOpenTasks } from '$lib/server/repo/tasks';
import { parseView, viewCookieName } from '$lib/view-cookie';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Les loads de layout et de page tournent en parallèle : chaque load vérifie lui-même l'accès.
	const space = await requireSpace(event, event.params.space, { onLocked: 'redirect' });
	return {
		tasks: await listOpenTasks(event.locals.db, space),
		view: parseView(event.cookies.get(viewCookieName(space)))
	};
};
