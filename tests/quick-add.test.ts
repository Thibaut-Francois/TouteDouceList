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
			dueDate: null
		});
	});

	it('extrait la priorité et la date, où qu’elles soient', () => {
		expect(parse('Payer facture !1 demain')).toEqual({
			title: 'Payer facture',
			priority: 1,
			dueDate: '2026-10-24'
		});
		expect(parse('!2 auj Appeler la banque')).toEqual({
			title: 'Appeler la banque',
			priority: 2,
			dueDate: today
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
		expect(parse('demain')).toEqual({ title: 'demain', priority: null, dueDate: null });
		expect(parse('!1')).toEqual({ title: '!1', priority: null, dueDate: null });
	});
});
