import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import { join } from 'node:path';
import { createDb, runMigrations, type Db } from '$lib/server/db/client';
import { spaces } from '$lib/server/db/schema';
import { SPACE_NAMES, SPACES } from '$lib/spaces';
import { TEST_DB_DIR } from './global-setup';

/** Base SQLite fraîche (fichier supprimé par global-setup en fin de run), migrations appliquées. */
export async function createTestDb() {
	const file = join(TEST_DB_DIR, `${crypto.randomUUID()}.db`);
	const db = createDb(`file:${file.replaceAll('\\', '/')}`);
	await runMigrations(db);
	return { db, cleanup: () => db.$client.close() };
}

export async function seedSpaces(db: Db) {
	for (const space of SPACES) {
		await db.insert(spaces).values({ id: space, name: SPACE_NAMES[space] });
	}
}

type FakeEventOptions = {
	db: Db;
	params: Record<string, string>;
	cookies?: Record<string, string>;
	method?: string;
	body?: unknown;
};

/** RequestEvent minimal pour appeler directement un load ou un endpoint. */
export function fakeEvent({ db, params, cookies = {}, method = 'GET', body }: FakeEventOptions) {
	const jar = new Map(Object.entries(cookies));
	const url = new URL('http://localhost/');
	return {
		params,
		url,
		locals: { db, unlocked: {} },
		cookies: {
			get: (name: string) => jar.get(name),
			getAll: () => [...jar].map(([name, value]) => ({ name, value })),
			set: (name: string, value: string) => void jar.set(name, value),
			delete: (name: string) => void jar.delete(name),
			serialize: () => ''
		},
		request: new Request(url, {
			method,
			headers: { 'content-type': 'application/json', origin: url.origin },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		getClientAddress: () => '127.0.0.1'
	} as unknown as RequestEvent;
}

/** Statut HTTP d'un handler, qu'il renvoie une Response ou lève error()/redirect(). */
export async function statusOf(result: Promise<Response> | Response) {
	try {
		return (await result).status;
	} catch (e) {
		if (isHttpError(e) || isRedirect(e)) return e.status;
		throw e;
	}
}
