import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { runMigrations, type Db } from '$lib/server/db/client';
import { seedReferenceData } from '$lib/server/db/seed';
import { createTestDb } from './helpers';

// La base de production telle qu'avant les profils (migrations 0000 à 0002), avec des données,
// puis la migration 0003 et le setup : rien ne doit changer, sauf le rattachement à un profil.

let db: Db;
let cleanup: () => void;
let before0003: string;

beforeEach(async () => {
	before0003 = mkdtempSync(join(tmpdir(), 'tdl-migrations-'));
	cpSync('drizzle', before0003, { recursive: true });
	const journalFile = join(before0003, 'meta', '_journal.json');
	const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
	journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0003');
	writeFileSync(journalFile, JSON.stringify(journal));

	({ db, cleanup } = await createTestDb(before0003));
	await db.$client.batch([
		`INSERT INTO spaces (id, name) VALUES ('pro', 'Pro'), ('perso', 'Perso')`,
		`INSERT INTO recurrences (id, space_id, title, notes, priority, rrule, preset, start_date, active, last_generated_date)
		 VALUES ('r-pro', 'pro', 'Relevé', '', 2, 'FREQ=DAILY', '{"kind":"daily"}', '2026-10-01', 1, '2026-10-27'),
		        ('r-perso', 'perso', 'Plantes', 'Arroser', 3, 'FREQ=WEEKLY;BYDAY=SA', '{"kind":"weekly"}', '2026-10-01', 0, NULL)`,
		`INSERT INTO tasks (id, space_id, title, notes, priority, due_date, status, created_at, completed_at, recurrence_id, occurrence_date, search)
		 VALUES ('t1', 'pro', 'Devis Martin', 'Appeler avant', 1, '2026-10-29', 'open', 1000, NULL, NULL, NULL, 'devis martin appeler avant'),
		        ('t2', 'pro', 'Relevé', '', 2, '2026-10-27', 'done', 2000, 3000, 'r-pro', '2026-10-27', 'releve'),
		        ('t3', 'perso', 'Courses', '', 3, NULL, 'open', 4000, NULL, NULL, NULL, 'courses')`
	]);
});

afterEach(() => {
	cleanup();
	rmSync(before0003, { recursive: true, force: true });
});

async function rows(table: string) {
	const result = await db.$client.execute(`SELECT * FROM ${table} ORDER BY id`);
	return result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c, r[i]])));
}

it('rattache les données Pro à Thibaut et Perso à Perso, sans rien modifier d’autre', async () => {
	const tasksBefore = await rows('tasks');
	const recurrencesBefore = await rows('recurrences');

	await runMigrations(db);
	const { attached } = await seedReferenceData(db);
	expect(attached).toBe(5);

	const expected = (row: Record<string, unknown>) => ({
		...row,
		profile_id: row.space_id === 'pro' ? 'thibaut' : 'perso'
	});
	// Colonnes d'avant 0003, plus profile_id (les migrations suivantes en ajoutent d'autres).
	const sameColumns = (after: Record<string, unknown>[], before: Record<string, unknown>[]) =>
		after.map((row) => Object.fromEntries(Object.keys(expected(before[0])).map((c) => [c, row[c]])));
	expect(sameColumns(await rows('tasks'), tasksBefore)).toEqual(tasksBefore.map(expected));
	expect(sameColumns(await rows('recurrences'), recurrencesBefore)).toEqual(recurrencesBefore.map(expected));

	expect(await rows('profiles')).toEqual([
		{ id: 'perso', space_id: 'perso', name: 'Perso' },
		{ id: 'philippe', space_id: 'pro', name: 'Philippe' },
		{ id: 'thibaut', space_id: 'pro', name: 'Thibaut' }
	]);
});

it('relancer le setup ne change rien ; il rattache seulement les données encore sans profil', async () => {
	await runMigrations(db);
	await seedReferenceData(db);
	const snapshot = await rows('tasks');

	expect((await seedReferenceData(db)).attached).toBe(0);
	expect(await rows('tasks')).toEqual(snapshot);

	// Tâche créée par l'ancienne version pendant le déploiement (sans profil).
	await db.$client.execute(
		`INSERT INTO tasks (id, space_id, title, created_at) VALUES ('t4', 'pro', 'Pendant le déploiement', 5000)`
	);
	expect((await seedReferenceData(db)).attached).toBe(1);
	expect((await rows('tasks')).find((t) => t.id === 't4')?.profile_id).toBe('thibaut');
});
