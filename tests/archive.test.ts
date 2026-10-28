import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupByDay } from '$lib/archive';
import type { Db } from '$lib/server/db/client';
import { generateDueOccurrences } from '$lib/server/recurrence/generate';
import { createRecurrence, updateRecurrence } from '$lib/server/repo/recurrences';
import { createTask, listArchive, listOpenTasks, updateTask, type Task } from '$lib/server/repo/tasks';
import { parseArchiveCursor } from '$lib/server/validate';
import type { Scope } from '$lib/spaces';
import { createTestDb, PERSO, seedSpaces, THIBAUT } from './helpers';

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
});
afterEach(() => cleanup());

const T0 = Date.UTC(2026, 9, 20, 10);
const HOUR = 3_600_000;

/** Crée une tâche et la termine à l'instant donné. */
async function done(
	title: string,
	completedAt: number,
	{ notes = '', scope = PERSO }: { notes?: string; scope?: Scope } = {}
) {
	const id = crypto.randomUUID();
	await createTask(db, scope, { id, title, notes, priority: 3, dueDate: null }, T0 - 24 * HOUR);
	await updateTask(db, scope, id, { status: 'done' }, completedAt);
	return id;
}

const titles = (tasks: Task[]) => tasks.map((t) => t.title);

describe('listArchive', () => {
	it('ne renvoie que les tâches terminées, de la plus récente à la plus ancienne', async () => {
		await done('Ancienne', T0);
		await done('Récente', T0 + 2 * HOUR);
		await done('Milieu', T0 + HOUR);
		await createTask(db, PERSO, { id: crypto.randomUUID(), title: 'Ouverte', notes: '', priority: 3, dueDate: null });

		expect(titles((await listArchive(db, PERSO)).tasks)).toEqual(['Récente', 'Milieu', 'Ancienne']);
	});

	it('ne renvoie jamais les tâches de l’autre espace', async () => {
		await done('Perso', T0);
		await done('Pro', T0, { scope: THIBAUT });
		expect(titles((await listArchive(db, PERSO)).tasks)).toEqual(['Perso']);
		expect(titles((await listArchive(db, THIBAUT)).tasks)).toEqual(['Pro']);
	});

	it('cherche sans accents ni casse dans le titre et les notes, tous les mots requis', async () => {
		await done('Réunion équipe', T0, { notes: 'Salle B' });
		await done('Banque', T0 + HOUR);
		const search = async (query: string) => titles((await listArchive(db, PERSO, { query })).tasks);

		expect(await search('reunion')).toEqual(['Réunion équipe']);
		expect(await search('EQUIPE salle')).toEqual(['Réunion équipe']);
		expect(await search('reunion banque')).toEqual([]);
		expect(await search('  ')).toEqual(['Banque', 'Réunion équipe']);
	});

	it('traite % et _ comme des caractères ordinaires', async () => {
		await done('Remise 50%', T0);
		await done('Remise 500', T0 + HOUR);
		await done('mot_clé', T0 + 2 * HOUR);
		await done('motXclé', T0 + 3 * HOUR);
		expect(titles((await listArchive(db, PERSO, { query: '50%' })).tasks)).toEqual(['Remise 50%']);
		expect(titles((await listArchive(db, PERSO, { query: 'mot_' })).tasks)).toEqual(['mot_clé']);
	});

	it('pagine par curseur sans trou ni doublon, même à complétion simultanée', async () => {
		for (let i = 0; i < 7; i++) await done(`Tâche ${i}`, T0 + (i < 4 ? 0 : i) * HOUR);
		const seen: string[] = [];
		let cursor;
		let pages = 0;
		do {
			const page = await listArchive(db, PERSO, { cursor, limit: 3 });
			seen.push(...titles(page.tasks));
			cursor = page.next ?? undefined;
			pages++;
		} while (cursor);
		expect(pages).toBe(3);
		expect(new Set(seen).size).toBe(7);
		expect(seen.slice(0, 3)).toEqual(['Tâche 6', 'Tâche 5', 'Tâche 4']);
	});

	it('met à jour la recherche quand le titre ou les notes changent', async () => {
		const id = await done('Brouillon', T0);
		await updateTask(db, PERSO, id, { notes: 'Contrat Dupré' });
		expect(titles((await listArchive(db, PERSO, { query: 'dupre' })).tasks)).toEqual(['Brouillon']);
		await updateTask(db, PERSO, id, { title: 'Version finale' });
		expect(titles((await listArchive(db, PERSO, { query: 'finale dupre' })).tasks)).toEqual(['Version finale']);
	});

	it('une tâche rouverte quitte l’archive', async () => {
		const id = await done('À refaire', T0);
		await updateTask(db, PERSO, id, { status: 'open' });
		expect((await listArchive(db, PERSO)).tasks).toEqual([]);
	});

	it('cherche aussi dans les occurrences, avec le titre reporté depuis la récurrence', async () => {
		const r = await createRecurrence(db, PERSO, {
			title: 'Arroser',
			notes: '',
			priority: 3,
			preset: { kind: 'daily' },
			startDate: '2026-10-20'
		});
		await generateDueOccurrences(db, PERSO, '2026-10-21');
		await updateRecurrence(db, PERSO, r.id, { title: 'Arroser les géraniums' }, '2026-10-21');
		for (const t of await listOpenTasks(db, PERSO)) await updateTask(db, PERSO, t.id, { status: 'done' });
		expect((await listArchive(db, PERSO, { query: 'geraniums' })).tasks).toHaveLength(2);
	});
});

describe('parseArchiveCursor', () => {
	it('lit « completedAt:id »', () => {
		const id = '0b7c8c1e-9a5f-4a57-9f3e-2f1d6c0a7b11';
		expect(parseArchiveCursor(`1792000000000:${id}`)).toEqual({ completedAt: 1792000000000, id });
		expect(parseArchiveCursor(null)).toBeUndefined();
		expect(parseArchiveCursor('')).toBeUndefined();
	});

	it.each(['abc', '12:pas-un-uuid', "1:' OR 1=1 --"])('rejette %s', (value) => {
		expect(() => parseArchiveCursor(value)).toThrow();
	});
});

describe('groupByDay', () => {
	const task = (title: string, completedAt: number) => ({ title, completedAt }) as Task;

	it('regroupe par jour de complétion à l’heure de Paris', () => {
		// 23 oct. 2026 22h30 UTC = 24 oct. 00h30 à Paris.
		const groups = groupByDay(
			[
				task('A', Date.UTC(2026, 9, 24, 8)),
				task('B', Date.UTC(2026, 9, 23, 22, 30)),
				task('C', Date.UTC(2026, 9, 23, 21, 30))
			],
			'2026-10-24'
		);
		expect(groups.map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
			["Aujourd'hui", ['A', 'B']],
			['Hier', ['C']]
		]);
	});
});
