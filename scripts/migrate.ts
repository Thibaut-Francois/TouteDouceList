import { runMigrations } from '../src/lib/server/db/client';
import { dbFromEnv, loadEnv } from './env';

loadEnv();
await runMigrations(dbFromEnv());
console.log('Migrations appliquées.');
