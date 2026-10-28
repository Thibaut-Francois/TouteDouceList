// Sauvegarde toutes les données de la base dans backups/<nom>-<date>.json (dossier jamais commité).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dumpDb, rowCounts } from './dump';
import { dbFromEnv, loadEnv } from './env';

loadEnv();
const db = dbFromEnv();
const dump = await dumpDb(db.$client);

const prod = process.argv.some((a) => a.startsWith('--env=.env.production'));
const stamp = dump.createdAt.slice(0, 19).replace(/[:T]/g, '-');
const file = `backups/${prod ? 'prod' : 'local'}-${stamp}.json`;
mkdirSync('backups', { recursive: true });
writeFileSync(file, JSON.stringify(dump));

console.table(rowCounts(dump));
console.log(`Sauvegarde écrite : ${file}`);
