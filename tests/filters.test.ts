import { describe, expect, it } from 'vitest';
import { applyView, DEFAULT_VIEW, sanitizeView, type View } from '$lib/filters';

// Vendredi 23 octobre 2026 : la semaine se termine le dimanche 25.
const today = '2026-10-23';

const task = (
	title: string,
	{
		priority = 3,
		dueDate = null,
		createdAt = 0,
		recurrenceId = null,
		stageId = null,
		notes = ''
	}: {
		priority?: number;
		dueDate?: string | null;
		createdAt?: number;
		recurrenceId?: string | null;
		stageId?: string | null;
		notes?: string;
	} = {}
) => ({ title, notes, priority, dueDate, createdAt, recurrenceId, stageId });

const tasks = [
	task('Rapport annuel', { priority: 1, dueDate: '2026-10-20', createdAt: 1 }),
	task('Réunion équipe', { priority: 2, dueDate: today, createdAt: 2, notes: 'Salle B' }),
	task('Arroser les plantes', { priority: 3, dueDate: '2026-10-25', createdAt: 3, recurrenceId: 'r1' }),
	task('Banque', { priority: 4, dueDate: '2026-10-26', createdAt: 4 }),
	task('Lire un livre', { priority: 3, createdAt: 5 })
];

const titles = (view: Partial<View>) =>
	applyView(tasks, { ...DEFAULT_VIEW, ...view }, today).map((t) => t.title);

describe('filtres', () => {
	it('sans filtre, garde tout', () => {
		expect(titles({})).toHaveLength(5);
	});

	it('priorités en multi-sélection (OU)', () => {
		expect(titles({ priorities: [1, 4] })).toEqual(['Rapport annuel', 'Banque']);
	});

	it.each([
		[['overdue'], ['Rapport annuel']],
		[['today'], ['Réunion équipe']],
		// Du jour au dimanche inclus : ni le retard, ni lundi prochain.
		[['week'], ['Réunion équipe', 'Arroser les plantes']],
		[['none'], ['Lire un livre']],
		[['overdue', 'none'], ['Rapport annuel', 'Lire un livre']]
	] as const)('échéance %j', (due, expected) => {
		expect(titles({ due: [...due] })).toEqual(expected);
	});

	it('type ponctuelle / récurrente', () => {
		expect(titles({ kinds: ['recurring'] })).toEqual(['Arroser les plantes']);
		expect(titles({ kinds: ['single'] })).not.toContain('Arroser les plantes');
	});

	it('type chantier : une tâche de chantier n’est ni ponctuelle ni récurrente', () => {
		const mixed = [...tasks, task('Poser placo', { stageId: 's1', createdAt: 6 })];
		const kinds = (k: View['kinds']) =>
			applyView(mixed, { ...DEFAULT_VIEW, kinds: k }, today).map((t) => t.title);
		expect(kinds(['project'])).toEqual(['Poser placo']);
		expect(kinds(['single'])).not.toContain('Poser placo');
		expect(kinds(['recurring'])).toEqual(['Arroser les plantes']);
		expect(kinds(['single', 'project'])).toHaveLength(5);
	});

	it('recherche sans accents ni casse, dans le titre et les notes, tous les mots requis', () => {
		expect(titles({ query: 'reunion' })).toEqual(['Réunion équipe']);
		expect(titles({ query: 'SALLE' })).toEqual(['Réunion équipe']);
		expect(titles({ query: 'reunion banque' })).toEqual([]);
	});

	it('combine les catégories (ET)', () => {
		expect(titles({ priorities: [2, 3], due: ['week'], kinds: ['single'] })).toEqual(['Réunion équipe']);
	});
});

describe('tris', () => {
	it('par défaut : en retard, puis priorité, puis échéance', () => {
		expect(titles({})).toEqual([
			'Rapport annuel',
			'Réunion équipe',
			'Arroser les plantes',
			'Lire un livre',
			'Banque'
		]);
	});

	it('priorité, puis échéance', () => {
		expect(titles({ sort: 'priority' })).toEqual([
			'Rapport annuel',
			'Réunion équipe',
			'Arroser les plantes',
			'Lire un livre',
			'Banque'
		]);
	});

	it('échéance, sans date en dernier', () => {
		expect(titles({ sort: 'due' })).toEqual([
			'Rapport annuel',
			'Réunion équipe',
			'Arroser les plantes',
			'Banque',
			'Lire un livre'
		]);
	});

	it('plus récentes d’abord', () => {
		expect(titles({ sort: 'created' })[0]).toBe('Lire un livre');
	});

	it('alphabétique, sans tenir compte des accents', () => {
		expect(titles({ sort: 'alpha' })).toEqual([
			'Arroser les plantes',
			'Banque',
			'Lire un livre',
			'Rapport annuel',
			'Réunion équipe'
		]);
	});
});

describe('sanitizeView', () => {
	it('retombe sur les valeurs par défaut pour une entrée invalide', () => {
		expect(sanitizeView(null)).toEqual(DEFAULT_VIEW);
		expect(sanitizeView('x')).toEqual(DEFAULT_VIEW);
	});

	it('ne garde que les valeurs connues', () => {
		expect(
			sanitizeView({
				priorities: [1, 9, '2'],
				due: ['today', 'jamais'],
				kinds: ['recurring', 'autre'],
				query: 'x'.repeat(500),
				sort: 'hasard'
			})
		).toEqual({ priorities: [1], due: ['today'], kinds: ['recurring'], query: 'x'.repeat(200), sort: 'default' });
	});
});
