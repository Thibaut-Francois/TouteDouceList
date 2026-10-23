import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = async ({ event, resolve }) => {
	// SvelteKit ne vérifie l'origine que pour les formulaires ; on l'impose aussi aux fetch JSON.
	if (!SAFE_METHODS.has(event.request.method)) {
		if (event.request.headers.get('origin') !== event.url.origin) {
			return new Response('Origine refusée', { status: 403 });
		}
	}

	event.locals.db = getDb();
	event.locals.unlocked = {};
	return resolve(event);
};
