// Applique les migrations, crée les espaces et les profils s'ils manquent,
// et rattache à leur profil les données qui n'en ont pas encore (seed.ts).
import { runMigrations } from '../src/lib/server/db/client';
import { seedReferenceData } from '../src/lib/server/db/seed';
import { dbFromEnv, loadEnv } from './env';

loadEnv();

const db = dbFromEnv();
await runMigrations(db);
const { attached } = await seedReferenceData(db);
console.log('Espaces Pro et Perso prêts ; profils Thibaut, Philippe et Perso prêts.');
console.log(`${attached} tâche(s) ou récurrence(s) rattachée(s) à leur profil.`);
