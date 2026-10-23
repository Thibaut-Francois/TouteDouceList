// Applique les migrations puis crée ou met à jour les deux espaces et leurs mots de passe.
// Changer un mot de passe déconnecte tous les appareils de cet espace.
import { eq } from 'drizzle-orm';
import { runMigrations } from '../src/lib/server/db/client';
import { sessions, spaces } from '../src/lib/server/db/schema';
import { hashPassword } from '../src/lib/server/password';
import { SPACES, SPACE_NAMES } from '../src/lib/spaces';
import { dbFromEnv, loadEnv } from './env';

const MIN_LENGTH = 12;

loadEnv();

const passwords = Object.fromEntries(
	SPACES.map((space) => [space, process.env[`PASSWORD_${space.toUpperCase()}`] ?? ''])
);

for (const space of SPACES) {
	if (passwords[space].length < MIN_LENGTH) {
		console.error(`PASSWORD_${space.toUpperCase()} doit faire au moins ${MIN_LENGTH} caractères.`);
		process.exit(1);
	}
}
if (passwords.pro === passwords.perso) {
	console.error('Les deux espaces doivent avoir des mots de passe différents.');
	process.exit(1);
}

const db = dbFromEnv();
await runMigrations(db);

for (const space of SPACES) {
	const passwordHash = await hashPassword(passwords[space]);
	await db
		.insert(spaces)
		.values({ id: space, name: SPACE_NAMES[space], passwordHash })
		.onConflictDoUpdate({ target: spaces.id, set: { passwordHash } });
	await db.delete(sessions).where(eq(sessions.spaceId, space));
	console.log(`Espace ${SPACE_NAMES[space]} prêt.`);
}
