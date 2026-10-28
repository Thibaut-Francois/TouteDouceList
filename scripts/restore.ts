// Remplace toutes les données de la base par celles d'une sauvegarde (backup.ts).
// Sans --oui, affiche seulement ce qui serait restauré.
import { readFileSync } from 'node:fs';
import { restoreDb, rowCounts, type Dump } from './dump';
import { dbFromEnv, loadEnv } from './env';

const file = process.argv.slice(2).find((a) => a.endsWith('.json'));
if (!file) throw new Error('Indiquer le fichier de sauvegarde : npm run restore:prod -- backups/<fichier>.json');

loadEnv();
const dump = JSON.parse(readFileSync(file, 'utf8')) as Dump;
console.log(`Sauvegarde du ${dump.createdAt} :`);
console.table(rowCounts(dump));

if (!process.argv.includes('--oui')) {
	console.log('Rien n’a été modifié. Pour remplacer TOUTES les données de la base par ce fichier, relancer avec --oui.');
	process.exit(0);
}

const db = dbFromEnv();
await restoreDb(db.$client, dump);
console.log('Données restaurées. Lancer ensuite le setup (npm run setup:prod) pour compléter les colonnes ajoutées depuis.');
