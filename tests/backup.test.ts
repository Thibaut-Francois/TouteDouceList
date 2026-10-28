import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { tasks } from '$lib/server/db/schema';
import { createTask, getTask } from '$lib/server/repo/tasks';
import { dumpDb, restoreDb, rowCounts } from '../scripts/dump';
import { createTestDb, PERSO, seedSpaces, THIBAUT } from './helpers';

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
});
afterEach(() => cleanup());

const task = (id: string, title: string) => ({ id, title, notes: '', priority: 3, dueDate: null });

it('restaure exactement les données sauvegardées', async () => {
	await createTask(db, THIBAUT, task('a', 'Devis'), 1000);
	await createTask(db, PERSO, task('b', 'Courses'), 2000);
	const dump = await dumpDb(db.$client);
	expect(rowCounts(dump)).toMatchObject({ spaces: 2, tasks: 2 });
	expect(Object.keys(dump.tables)).not.toContain('__drizzle_migrations');

	await db.delete(tasks);
	await createTask(db, THIBAUT, task('c', 'Ajoutée après la sauvegarde'));

	await restoreDb(db.$client, dump);
	expect(await dumpDb(db.$client)).toEqual({ ...dump, createdAt: expect.any(String) });
	expect(await getTask(db, THIBAUT, 'c')).toBeUndefined();
});

it('une colonne absente de la sauvegarde garde sa valeur par défaut', async () => {
	await createTask(db, THIBAUT, task('a', 'Devis'));
	const dump = await dumpDb(db.$client);
	const saved = dump.tables.tasks;
	const notes = saved.columns.indexOf('notes');
	saved.columns.splice(notes, 1);
	saved.rows.forEach((row) => row.splice(notes, 1));

	await restoreDb(db.$client, dump);
	expect(await getTask(db, THIBAUT, 'a')).toMatchObject({ title: 'Devis', notes: '' });
});

it('tout ou rien : une erreur laisse la base intacte', async () => {
	await createTask(db, THIBAUT, task('a', 'Devis'));
	const dump = await dumpDb(db.$client);
	dump.tables.tasks.rows.push([...dump.tables.tasks.rows[0]]); // doublon de clé primaire

	await expect(restoreDb(db.$client, dump)).rejects.toThrow();
	expect(await getTask(db, THIBAUT, 'a')).toMatchObject({ title: 'Devis' });
});
