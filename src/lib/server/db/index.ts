import { env } from '$env/dynamic/private';
import { createDb, type Db } from './client';

let db: Db | undefined;

export function getDb(): Db {
	if (!db) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL manquante');
		db = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN || undefined);
	}
	return db;
}
