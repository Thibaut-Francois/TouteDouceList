import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { tasks } from '$lib/server/db/schema';
import { generateDueOccurrences } from '$lib/server/recurrence/generate';
import {
	createRecurrence,
	deleteRecurrence,
	getRecurrence,
	updateRecurrence,
	type RecurrenceInput
} from '$lib/server/repo/recurrences';
import { updateTask } from '$lib/server/repo/tasks';
import { createTestDb, seedSpaces } from './helpers';

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
	({ db, cleanup } = await createTestDb());
	await seedSpaces(db);
});
afterEach(() => cleanup());

const daily = (overrides: Partial<RecurrenceInput> = {}): RecurrenceInput => ({
	title: 'Arroser',
	notes: '',
	priority: 3,
	preset: { kind: 'daily' },
	startDate: '2026-10-20',
	...overrides
});

const occurrences = (recurrenceId: string) =>
	db
		.select()
		.from(tasks)
		.where(eq(tasks.recurrenceId, recurrenceId))
		.orderBy(tasks.occurrenceDate);

const dates = async (recurrenceId: string) => (await occurrences(recurrenceId)).map((t) => t.occurrenceDate);

describe('generateDueOccurrences', () => {
	it("crée les occurrences dues jusqu'à aujourd'hui inclus", async () => {
		const r = await createRecurrence(db, 'perso', daily());
		expect(await generateDueOccurrences(db, 'perso', '2026-10-22')).toBe(3);
		expect(await dates(r.id)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
		const [first] = await occurrences(r.id);
		expect(first).toMatchObject({ title: 'Arroser', dueDate: '2026-10-20', status: 'open', spaceId: 'perso' });
	});

	it('rattrape après plusieurs jours sans ouverture, sans toucher aux occurrences déjà créées (cumul)', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-21');
		expect(await generateDueOccurrences(db, 'perso', '2026-10-26')).toBe(5);
		expect(await dates(r.id)).toEqual([
			'2026-10-20',
			'2026-10-21',
			'2026-10-22',
			'2026-10-23',
			'2026-10-24',
			'2026-10-25',
			'2026-10-26'
		]);
		expect((await occurrences(r.id)).every((t) => t.status === 'open')).toBe(true);
	});

	it('est idempotente : relancer le même jour ne crée rien', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-22');
		expect(await generateDueOccurrences(db, 'perso', '2026-10-22')).toBe(0);
		expect(await dates(r.id)).toHaveLength(3);
	});

	it('ne crée aucun doublon quand deux appareils génèrent en même temps', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		const results = await Promise.all([
			generateDueOccurrences(db, 'perso', '2026-10-25'),
			generateDueOccurrences(db, 'perso', '2026-10-25'),
			generateDueOccurrences(db, 'perso', '2026-10-25')
		]);
		expect(results.reduce((a, b) => a + b, 0)).toBe(6);
		expect(await dates(r.id)).toEqual([
			'2026-10-20',
			'2026-10-21',
			'2026-10-22',
			'2026-10-23',
			'2026-10-24',
			'2026-10-25'
		]);
	});

	it("rend un doublon impossible au niveau de la base, même en contournant l'algorithme", async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-20');
		const [occurrence] = await occurrences(r.id);
		await expect(
			db.insert(tasks).values({ ...occurrence, id: crypto.randomUUID() })
		).rejects.toThrow();
	});

	it('ne crée rien avant la date de début, puis démarre à cette date', async () => {
		const r = await createRecurrence(db, 'perso', daily({ startDate: '2026-11-01' }));
		expect(await generateDueOccurrences(db, 'perso', '2026-10-25')).toBe(0);
		await generateDueOccurrences(db, 'perso', '2026-11-02');
		expect(await dates(r.id)).toEqual(['2026-11-01', '2026-11-02']);
	});

	it('ne génère que dans son espace', async () => {
		await createRecurrence(db, 'pro', daily());
		expect(await generateDueOccurrences(db, 'perso', '2026-10-25')).toBe(0);
		expect(await generateDueOccurrences(db, 'pro', '2026-10-25')).toBe(6);
	});

	it('ne génère rien en pause et ne rattrape pas la pause à la reprise', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-21');
		await updateRecurrence(db, 'perso', r.id, { active: false }, '2026-10-21');
		expect(await generateDueOccurrences(db, 'perso', '2026-10-24')).toBe(0);

		await updateRecurrence(db, 'perso', r.id, { active: true }, '2026-10-26');
		await generateDueOccurrences(db, 'perso', '2026-10-26');
		expect(await dates(r.id)).toEqual(['2026-10-20', '2026-10-21', '2026-10-26']);
	});

	it('premier lundi du mois, rattrapé sur plusieurs mois', async () => {
		const r = await createRecurrence(
			db,
			'perso',
			daily({ preset: { kind: 'monthly-nth', nth: 1, day: 'MO' }, startDate: '2026-10-01' })
		);
		await generateDueOccurrences(db, 'perso', '2027-01-04');
		expect(await dates(r.id)).toEqual(['2026-10-05', '2026-11-02', '2026-12-07', '2027-01-04']);
	});
});

describe('modification et suppression', () => {
	it('reporte titre, notes et priorité sur les occurrences ouvertes, jamais sur les terminées', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-21');
		const [done, open] = await occurrences(r.id);
		await updateTask(db, 'perso', done.id, { status: 'done' });

		await updateRecurrence(db, 'perso', r.id, { title: 'Arroser le jardin', priority: 1 }, '2026-10-21');

		expect((await occurrences(r.id)).map((t) => [t.id, t.title, t.priority])).toEqual([
			[done.id, 'Arroser', 3],
			[open.id, 'Arroser le jardin', 1]
		]);
	});

	it("une nouvelle règle ne vaut que pour l'avenir", async () => {
		const r = await createRecurrence(db, 'perso', daily({ startDate: '2026-10-19' }));
		await generateDueOccurrences(db, 'perso', '2026-10-21');
		await updateRecurrence(db, 'perso', r.id, { preset: { kind: 'weekly', day: 'MO' } }, '2026-10-21');
		await generateDueOccurrences(db, 'perso', '2026-11-03');
		expect(await dates(r.id)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-26', '2026-11-02']);
		expect((await getRecurrence(db, 'perso', r.id))?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
	});

	it('la suppression retire les occurrences ouvertes, garde les terminées et arrête la génération', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-22');
		const [done] = await occurrences(r.id);
		await updateTask(db, 'perso', done.id, { status: 'done' });

		expect(await deleteRecurrence(db, 'perso', r.id)).toBe(true);
		expect((await occurrences(r.id)).map((t) => [t.id, t.status])).toEqual([[done.id, 'done']]);
		expect(await getRecurrence(db, 'perso', r.id)).toBeUndefined();
		expect(await generateDueOccurrences(db, 'perso', '2026-10-30')).toBe(0);
	});

	it('la suppression peut garder les occurrences ouvertes', async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-22');
		await deleteRecurrence(db, 'perso', r.id, { keepOpen: true });
		const kept = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.recurrenceId, r.id), eq(tasks.status, 'open')));
		expect(kept).toHaveLength(3);
	});

	it("compte les occurrences ouvertes pour la confirmation", async () => {
		const r = await createRecurrence(db, 'perso', daily());
		await generateDueOccurrences(db, 'perso', '2026-10-22');
		expect((await getRecurrence(db, 'perso', r.id))?.openCount).toBe(3);
	});
});
