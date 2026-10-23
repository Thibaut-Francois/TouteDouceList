// Applique les migrations puis crée les deux espaces s'ils n'existent pas.
import { runMigrations } from '../src/lib/server/db/client';
import { spaces } from '../src/lib/server/db/schema';
import { SPACES, SPACE_NAMES } from '../src/lib/spaces';
import { dbFromEnv, loadEnv } from './env';

loadEnv();

const db = dbFromEnv();
await runMigrations(db);

for (const space of SPACES) {
	await db.insert(spaces).values({ id: space, name: SPACE_NAMES[space] }).onConflictDoNothing();
	console.log(`Espace ${SPACE_NAMES[space]} prêt.`);
}
