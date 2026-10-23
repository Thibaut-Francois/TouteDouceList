import { createDb } from '../src/lib/server/db/client';

/** Charge .env, ou le fichier passé en --env=<fichier> (obligatoire alors : pas de repli silencieux). */
export function loadEnv() {
	const arg = process.argv.find((a) => a.startsWith('--env='));
	const file = arg ? arg.slice('--env='.length) : '.env';
	try {
		process.loadEnvFile(file);
	} catch {
		if (arg) throw new Error(`Fichier ${file} introuvable.`);
		// Pas de .env : on s'appuie sur les variables déjà présentes.
	}
}

export function dbFromEnv() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL manquante (voir .env.example)');
	// L'hôte seul : le jeton n'est jamais affiché.
	console.log(`Base : ${url.startsWith('file:') ? url : new URL(url).host}`);
	return createDb(url, process.env.DATABASE_AUTH_TOKEN || undefined);
}
