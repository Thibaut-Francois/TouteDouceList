import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '$lib/quick-add';

// Vendredi 23 octobre 2026.
const today = '2026-10-23';
const parse = (input: string) => parseQuickAdd(input, today);

describe('parseQuickAdd', () => {
	it('sans syntaxe, garde le texte tel quel', () => {
		expect(parse('  Acheter du pain  ')).toEqual({
			title: 'Acheter du pain',
			priority: null,
			dueDate: null,
			assignee: null
		});
	});

	it('extrait la priorité et la date, où qu’elles soient', () => {
		expect(parse('Payer facture !1 demain')).toEqual({
			title: 'Payer facture',
			priority: 1,
			dueDate: '2026-10-24',
			assignee: null
		});
		expect(parse('!2 auj Appeler la banque')).toEqual({
			title: 'Appeler la banque',
			priority: 2,
			dueDate: today,
			assignee: null
		});
	});

	it.each([
		['aujourd’hui', today],
		["Aujourd'hui", today],
		['AUJ', today],
		['Demain', '2026-10-24'],
		['samedi', '2026-10-24'],
		['dimanche', '2026-10-25'],
		['lundi', '2026-10-26'],
		['jeudi', '2026-10-29'],
		// Le jour même désigne la semaine suivante.
		['vendredi', '2026-10-30']
	])('« %s » → %s', (word, expected) => {
		expect(parse(`Tâche ${word}`).dueDate).toBe(expected);
	});

	it('ignore les accents et la casse des jours', () => {
		expect(parse('Tâche MERCREDI').dueDate).toBe('2026-10-28');
	});

	it('ne reconnaît que !1 à !4, en mot isolé', () => {
		expect(parse('Tâche !5')).toMatchObject({ title: 'Tâche !5', priority: null });
		expect(parse('Super!1')).toMatchObject({ title: 'Super!1', priority: null });
	});

	it('garde la dernière valeur si un élément est répété', () => {
		expect(parse('Tâche !1 !3 auj demain')).toMatchObject({ priority: 3, dueDate: '2026-10-24' });
	});

	it('prend tout le texte comme titre quand il ne contient que de la syntaxe', () => {
		expect(parse('demain')).toEqual({ title: 'demain', priority: null, dueDate: null, assignee: null });
		expect(parse('!1')).toEqual({ title: '!1', priority: null, dueDate: null, assignee: null });
	});
});

describe('attribution dans un chantier (@t / @p)', () => {
	const assignees = { t: 'thibaut', p: 'philippe' } as const;
	const inProject = (input: string) => parseQuickAdd(input, today, { assignees });

	it('reconnaît @t et @p, en mot isolé, quelle que soit la casse', () => {
		expect(inProject('Poser placo @p demain !2')).toEqual({
			title: 'Poser placo',
			priority: 2,
			dueDate: '2026-10-24',
			assignee: 'philippe'
		});
		expect(inProject('@T Commander')).toMatchObject({ title: 'Commander', assignee: 'thibaut' });
		expect(inProject('mail@p.fr')).toMatchObject({ title: 'mail@p.fr', assignee: null });
	});

	it('garde un @ inconnu dans le titre', () => {
		expect(inProject('Voir @x')).toMatchObject({ title: 'Voir @x', assignee: null });
	});

	it('hors chantier (sans option), @t reste un mot du titre', () => {
		expect(parse('Appeler @t')).toMatchObject({ title: 'Appeler @t', assignee: null });
	});
});
