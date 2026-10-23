import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export function createDb(url: string, authToken?: string) {
	return drizzle(createClient({ url, authToken }), { schema });
}

export type Db = ReturnType<typeof createDb>;

export function runMigrations(db: Db, migrationsFolder = 'drizzle') {
	return migrate(db, { migrationsFolder });
}
