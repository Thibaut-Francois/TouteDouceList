import type { Client, InStatement } from '@libsql/client';

// Sauvegarde et restauration des données (pas du schéma) : la restauration se fait sur une base
// déjà migrée, colonne par colonne. Une colonne apparue depuis la sauvegarde garde sa valeur par défaut.

export type Dump = {
	createdAt: string;
	tables: Record<string, { columns: string[]; rows: unknown[][] }>;
};

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * Tables de données, chaque table après celles qu'elle référence (clés étrangères).
 * Sans les tables internes (`sqlite_*`, `__drizzle_migrations`) : l'historique des migrations
 * décrit le schéma, pas les données.
 */
async function dataTables(client: Client) {
	const { rows } = await client.execute(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`
	);
	const names = rows.map((r) => String(r.name));
	const deps = new Map<string, string[]>();
	for (const name of names) {
		const fks = await client.execute(`PRAGMA foreign_key_list(${quote(name)})`);
		deps.set(
			name,
			fks.rows.map((r) => String(r.table)).filter((t) => t !== name)
		);
	}
	const ordered: string[] = [];
	const visit = (name: string) => {
		if (ordered.includes(name) || !deps.has(name)) return;
		deps.get(name)!.forEach(visit);
		ordered.push(name);
	};
	names.forEach(visit);
	return ordered;
}

export async function dumpDb(client: Client): Promise<Dump> {
	const dump: Dump = { createdAt: new Date().toISOString(), tables: {} };
	for (const table of await dataTables(client)) {
		const result = await client.execute(`SELECT * FROM ${quote(table)}`);
		dump.tables[table] = { columns: result.columns, rows: result.rows.map((r) => Array.from(r)) };
	}
	return dump;
}

export function rowCounts(dump: Dump) {
	return Object.fromEntries(Object.entries(dump.tables).map(([t, { rows }]) => [t, rows.length]));
}

/** Remplace toutes les données par celles de la sauvegarde, en une seule transaction (tout ou rien). */
export async function restoreDb(client: Client, dump: Dump) {
	const tables = await dataTables(client);
	const statements: InStatement[] = [];

	for (const table of [...tables].reverse()) statements.push(`DELETE FROM ${quote(table)}`);

	for (const table of tables) {
		const saved = dump.tables[table];
		if (!saved || saved.rows.length === 0) continue;
		const existing = await client.execute(`PRAGMA table_info(${quote(table)})`);
		const current = new Set(existing.rows.map((r) => String(r.name)));
		const kept = saved.columns.map((c, i) => [c, i] as const).filter(([c]) => current.has(c));
		const sql = `INSERT INTO ${quote(table)} (${kept.map(([c]) => quote(c)).join(', ')}) VALUES (${kept.map(() => '?').join(', ')})`;
		for (const row of saved.rows) {
			statements.push({ sql, args: kept.map(([, i]) => row[i] as never) });
		}
	}

	await client.batch(statements, 'write');
}
