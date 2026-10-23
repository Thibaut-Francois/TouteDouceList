import { describe, expect, it } from 'vitest';
import { describePreset, sanitizePreset, type Preset } from '$lib/recurrence/presets';

describe('describePreset', () => {
	it.each([
		[{ kind: 'daily' }, 'Tous les jours'],
		[{ kind: 'weekly', day: 'TU' }, 'Chaque mardi'],
		[{ kind: 'monthly-day', day: 1 }, 'Le 1er de chaque mois'],
		[{ kind: 'monthly-day', day: 31 }, 'Le 31 de chaque mois (ou le dernier jour)'],
		[{ kind: 'monthly-nth', nth: 1, day: 'MO' }, 'Le premier lundi du mois'],
		[{ kind: 'monthly-nth', nth: -1, day: 'FR' }, 'Le dernier vendredi du mois'],
		[{ kind: 'month-last-day' }, 'Le dernier jour du mois'],
		[{ kind: 'yearly', month: 7, day: 14 }, 'Chaque année le 14 juillet'],
		[{ kind: 'custom', interval: 1, unit: 'month', days: [] }, 'Chaque mois'],
		[{ kind: 'custom', interval: 2, unit: 'week', days: ['TH', 'MO'] }, 'Tous les 2 semaines (lundi, jeudi)'],
		[{ kind: 'custom', interval: 3, unit: 'day', days: [] }, 'Tous les 3 jours']
	] as [Preset, string][])('%j → %s', (preset, label) => {
		expect(describePreset(preset)).toBe(label);
	});
});

describe('sanitizePreset', () => {
	it('accepte les préréglages valides', () => {
		expect(sanitizePreset({ kind: 'weekly', day: 'MO' })).toEqual({ kind: 'weekly', day: 'MO' });
		expect(sanitizePreset({ kind: 'yearly', month: 2, day: 29 })).toEqual({ kind: 'yearly', month: 2, day: 29 });
	});

	it('ignore les jours pour une unité autre que la semaine et trie les jours', () => {
		expect(sanitizePreset({ kind: 'custom', interval: 2, unit: 'day', days: ['MO'] })).toEqual({
			kind: 'custom',
			interval: 2,
			unit: 'day',
			days: []
		});
		expect(sanitizePreset({ kind: 'custom', interval: 1, unit: 'week', days: ['FR', 'MO'] })).toMatchObject({
			days: ['MO', 'FR']
		});
	});

	it.each([
		null,
		'daily',
		{ kind: 'inconnu' },
		{ kind: 'weekly', day: 'XX' },
		{ kind: 'monthly-day', day: 32 },
		{ kind: 'monthly-day', day: 0 },
		{ kind: 'monthly-nth', nth: 5, day: 'MO' },
		{ kind: 'yearly', month: 2, day: 30 },
		{ kind: 'yearly', month: 13, day: 1 },
		{ kind: 'custom', interval: 0, unit: 'day', days: [] },
		{ kind: 'custom', interval: 100, unit: 'day', days: [] },
		{ kind: 'custom', interval: 1, unit: 'hour', days: [] },
		{ kind: 'custom', interval: 1, unit: 'week', days: ['XX'] }
	])('rejette %j', (raw) => {
		expect(sanitizePreset(raw)).toBeNull();
	});
});
