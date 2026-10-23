import { describe, expect, it } from 'vitest';
import { addDays } from '$lib/dates';
import { defaultPreset, presetToRrule, type Preset } from '$lib/recurrence/presets';
import { nextOccurrences, occurrencesBetween } from '$lib/server/recurrence/engine';

const between = (preset: Preset, start: string, from: string, to: string) =>
	occurrencesBetween(presetToRrule(preset), start, from, to);

describe('moteur de récurrence', () => {
	it('premier lundi du mois', () => {
		expect(between({ kind: 'monthly-nth', nth: 1, day: 'MO' }, '2026-10-01', '2026-10-01', '2027-01-31')).toEqual([
			'2026-10-05',
			'2026-11-02',
			'2026-12-07',
			'2027-01-04'
		]);
	});

	it('dernier vendredi du mois', () => {
		expect(between({ kind: 'monthly-nth', nth: -1, day: 'FR' }, '2026-10-01', '2026-10-01', '2026-12-31')).toEqual([
			'2026-10-30',
			'2026-11-27',
			'2026-12-25'
		]);
	});

	it('quatrième jeudi du mois', () => {
		expect(between({ kind: 'monthly-nth', nth: 4, day: 'TH' }, '2026-11-01', '2026-11-01', '2026-11-30')).toEqual([
			'2026-11-26'
		]);
	});

	it('jours ouvrés : du lundi au vendredi, jamais le week-end', () => {
		expect(between({ kind: 'weekdays' }, '2026-10-22', '2026-10-22', '2026-10-28')).toEqual([
			'2026-10-22',
			'2026-10-23',
			'2026-10-26',
			'2026-10-27',
			'2026-10-28'
		]);
	});

	it('« le 31 » est ramené au dernier jour des mois courts, février et années bissextiles compris', () => {
		expect(between({ kind: 'monthly-day', day: 31 }, '2027-01-01', '2027-01-01', '2027-06-30')).toEqual([
			'2027-01-31',
			'2027-02-28',
			'2027-03-31',
			'2027-04-30',
			'2027-05-31',
			'2027-06-30'
		]);
		expect(between({ kind: 'monthly-day', day: 31 }, '2028-02-01', '2028-02-01', '2028-02-29')).toEqual([
			'2028-02-29'
		]);
	});

	it('« le 30 » en février tombe le 28 ou le 29', () => {
		expect(between({ kind: 'monthly-day', day: 30 }, '2027-01-01', '2027-01-01', '2027-03-31')).toEqual([
			'2027-01-30',
			'2027-02-28',
			'2027-03-30'
		]);
		expect(between({ kind: 'monthly-day', day: 30 }, '2028-02-01', '2028-02-01', '2028-02-29')).toEqual([
			'2028-02-29'
		]);
	});

	it('« le 15 » reste le 15', () => {
		expect(between({ kind: 'monthly-day', day: 15 }, '2026-10-15', '2026-10-01', '2026-12-31')).toEqual([
			'2026-10-15',
			'2026-11-15',
			'2026-12-15'
		]);
	});

	it('dernier jour du mois', () => {
		expect(between({ kind: 'month-last-day' }, '2027-12-01', '2027-12-01', '2028-04-30')).toEqual([
			'2027-12-31',
			'2028-01-31',
			'2028-02-29',
			'2028-03-31',
			'2028-04-30'
		]);
	});

	it('chaque année le 29 février : le 28 les années non bissextiles', () => {
		expect(between({ kind: 'yearly', month: 2, day: 29 }, '2028-02-29', '2028-01-01', '2032-12-31')).toEqual([
			'2028-02-29',
			'2029-02-28',
			'2030-02-28',
			'2031-02-28',
			'2032-02-29'
		]);
	});

	it('chaque année le 14 juillet', () => {
		expect(between({ kind: 'yearly', month: 7, day: 14 }, '2026-07-14', '2026-01-01', '2028-12-31')).toEqual([
			'2026-07-14',
			'2027-07-14',
			'2028-07-14'
		]);
	});

	it.each([
		['heure d’hiver', '2026-10-20', '2026-10-31'],
		['heure d’été', '2026-03-24', '2026-04-04']
	])('tous les jours à travers le passage à l’%s : ni trou ni doublon', (_, from, to) => {
		const dates = between({ kind: 'daily' }, from, from, to);
		const expected: string[] = [];
		for (let d = from; d <= to; d = addDays(d, 1)) expected.push(d);
		expect(dates).toEqual(expected);
	});

	it('chaque dimanche à travers les deux changements d’heure de 2026', () => {
		expect(between({ kind: 'weekly', day: 'SU' }, '2026-03-22', '2026-03-22', '2026-04-05')).toEqual([
			'2026-03-22',
			'2026-03-29',
			'2026-04-05'
		]);
		expect(between({ kind: 'weekly', day: 'SU' }, '2026-10-18', '2026-10-18', '2026-11-01')).toEqual([
			'2026-10-18',
			'2026-10-25',
			'2026-11-01'
		]);
	});

	it('personnalisée : toutes les 2 semaines le lundi et le jeudi', () => {
		expect(
			between({ kind: 'custom', interval: 2, unit: 'week', days: ['TH', 'MO'] }, '2026-10-19', '2026-10-19', '2026-11-15')
		).toEqual(['2026-10-19', '2026-10-22', '2026-11-02', '2026-11-05']);
	});

	it('personnalisée : tous les 3 jours', () => {
		expect(
			between({ kind: 'custom', interval: 3, unit: 'day', days: [] }, '2026-10-23', '2026-10-23', '2026-11-01')
		).toEqual(['2026-10-23', '2026-10-26', '2026-10-29', '2026-11-01']);
	});

	it('ne renvoie rien avant la date de début', () => {
		expect(between({ kind: 'daily' }, '2026-11-01', '2026-10-25', '2026-11-02')).toEqual([
			'2026-11-01',
			'2026-11-02'
		]);
	});

	it('nextOccurrences pour l’aperçu', () => {
		expect(nextOccurrences(presetToRrule({ kind: 'weekly', day: 'TU' }), '2026-10-01', '2026-10-23', 3)).toEqual([
			'2026-10-27',
			'2026-11-03',
			'2026-11-10'
		]);
	});
});

describe('presets', () => {
	it.each([
		[{ kind: 'daily' }, 'FREQ=DAILY'],
		[{ kind: 'weekdays' }, 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
		[{ kind: 'weekly', day: 'WE' }, 'FREQ=WEEKLY;BYDAY=WE'],
		[{ kind: 'monthly-day', day: 10 }, 'FREQ=MONTHLY;BYMONTHDAY=10'],
		[{ kind: 'monthly-day', day: 31 }, 'FREQ=MONTHLY;BYMONTHDAY=31,-1;BYSETPOS=1'],
		[{ kind: 'monthly-nth', nth: -1, day: 'FR' }, 'FREQ=MONTHLY;BYDAY=-1FR'],
		[{ kind: 'month-last-day' }, 'FREQ=MONTHLY;BYMONTHDAY=-1'],
		[{ kind: 'yearly', month: 2, day: 29 }, 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29,-1;BYSETPOS=1']
	] as [Preset, string][])('%j → %s', (preset, rrule) => {
		expect(presetToRrule(preset)).toBe(rrule);
	});

	it('defaultPreset se cale sur la date de début', () => {
		// Vendredi 23 octobre 2026 : quatrième vendredi du mois.
		expect(defaultPreset('weekly', '2026-10-23')).toEqual({ kind: 'weekly', day: 'FR' });
		expect(defaultPreset('monthly-nth', '2026-10-23')).toEqual({ kind: 'monthly-nth', nth: 4, day: 'FR' });
		expect(defaultPreset('monthly-nth', '2026-10-30')).toEqual({ kind: 'monthly-nth', nth: 4, day: 'FR' });
		expect(defaultPreset('yearly', '2026-10-23')).toEqual({ kind: 'yearly', month: 10, day: 23 });
	});
});
