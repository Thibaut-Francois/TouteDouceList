import { createDb } from '../src/lib/server/db/client';

export function loadEnv() {
	try {
		process.loadEnvFile();
	} catch {
		// Pas de .env : on s'appuie sur les variables déjà présentes.
	}
}

export function dbFromEnv() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL manquante (voir .env.example)');
	return createDb(url, process.env.DATABASE_AUTH_TOKEN || undefined);
}
