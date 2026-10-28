import { describe, expect, it } from 'vitest';
import { currentStage, isOutsideStage, move, progress, projectDates, stageStatus } from '$lib/projects';

const stage = (startDate: string, endDate: string) => ({ startDate, endDate });
const counts = (total: number, done: number) => ({ total, done });

describe('stageStatus', () => {
	const s = stage('2026-11-02', '2026-11-06');

	it.each([
		// [aujourd'hui, total, faites, statut]
		['2026-11-01', 2, 0, 'upcoming'],
		['2026-11-02', 2, 0, 'current'], // jour de début
		['2026-11-06', 2, 1, 'current'], // jour de fin
		['2026-11-07', 2, 1, 'late'], // lendemain de la fin, tâches ouvertes
		['2026-11-07', 2, 2, 'done'],
		['2026-11-01', 2, 2, 'done'], // toutes faites avant même le début
		['2026-11-04', 0, 0, 'current'], // étape vide en cours
		['2026-11-01', 0, 0, 'upcoming'], // étape vide à venir
		['2026-11-07', 0, 0, 'done'] // étape vide passée
	] as const)('%s, %i tâche(s) dont %i faite(s) → %s', (today, total, done, expected) => {
		expect(stageStatus(s, counts(total, done), today)).toBe(expected);
	});
});

describe('currentStage', () => {
	const stages = [
		{ ...stage('2026-11-02', '2026-11-06'), counts: counts(2, 2), name: 'Démolition' },
		{ ...stage('2026-11-09', '2026-11-13'), counts: counts(3, 1), name: 'Placo' },
		{ ...stage('2026-11-16', '2026-11-20'), counts: counts(1, 0), name: 'Peinture' }
	];

	it('première étape non terminée, même en retard ou à venir', () => {
		expect(currentStage(stages, '2026-11-10')?.name).toBe('Placo');
		expect(currentStage(stages, '2026-11-30')?.name).toBe('Placo'); // en retard
		expect(currentStage(stages, '2026-10-01')?.name).toBe('Placo'); // Démolition déjà faite
	});

	it('aucune si tout est terminé', () => {
		expect(currentStage([stages[0]], '2026-11-10')).toBeUndefined();
	});
});

describe('progress et dates du chantier', () => {
	it('additionne les tâches', () => {
		expect(progress([counts(2, 2), counts(3, 1)])).toEqual({ total: 5, done: 3 });
		expect(progress([])).toEqual({ total: 0, done: 0 });
	});

	it('du plus tôt des débuts au plus tard des fins, chevauchements compris', () => {
		expect(
			projectDates([
				stage('2026-11-09', '2026-11-20'),
				stage('2026-11-02', '2026-11-06'),
				stage('2026-11-10', '2026-11-12')
			])
		).toEqual(stage('2026-11-02', '2026-11-20'));
		expect(projectDates([])).toBeNull();
	});
});

it('isOutsideStage', () => {
	const s = stage('2026-11-02', '2026-11-06');
	expect(isOutsideStage(null, s)).toBe(false);
	expect(isOutsideStage('2026-11-02', s)).toBe(false);
	expect(isOutsideStage('2026-11-06', s)).toBe(false);
	expect(isOutsideStage('2026-11-01', s)).toBe(true);
	expect(isOutsideStage('2026-11-07', s)).toBe(true);
});

describe('move', () => {
	const ids = ['a', 'b', 'c', 'd'];
	it.each([
		[0, 2, ['b', 'c', 'a', 'd']],
		[3, 0, ['d', 'a', 'b', 'c']],
		[1, 2, ['a', 'c', 'b', 'd']],
		[2, 2, ['a', 'b', 'c', 'd']],
		[0, 9, ['a', 'b', 'c', 'd']] // hors limites : inchangé
	])('de %i à %i', (from, to, expected) => {
		expect(move(ids, from, to)).toEqual(expected);
		expect(ids).toEqual(['a', 'b', 'c', 'd']);
	});
});
