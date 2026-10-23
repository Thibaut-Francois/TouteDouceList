import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Les bases de test sont supprimées ici, une fois les workers terminés :
// sous Windows, libSQL garde le fichier verrouillé tant que le processus vit.
export const TEST_DB_DIR = join(tmpdir(), 'toutedoucelist-tests');

export default function setup() {
	rmSync(TEST_DB_DIR, { recursive: true, force: true });
	mkdirSync(TEST_DB_DIR, { recursive: true });
	return () => rmSync(TEST_DB_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
