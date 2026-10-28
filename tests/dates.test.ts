import { describe, expect, it } from 'vitest';
import {
	addDays,
	dayOfWeek,
	formatDateTitle,
	formatTaskDate,
	startOfWeek,
	todayInParis
} from '$lib/dates';

describe('todayInParis', () => {
	it.each([
		// Été (UTC+2) : 22h30 UTC = 00h30 à Paris, le lendemain.
		['2026-07-14T22:30:00Z', '2026-07-15'],
		['2026-07-14T21:59:00Z', '2026-07-14'],
		// Hiver (UTC+1).
		['2026-12-31T23:30:00Z', '2027-01-01'],
		['2026-12-31T22:59:00Z', '2026-12-31'],
		// Passage à l'heure d'hiver, nuit du 24 au 25 octobre 2026.
		['2026-10-24T22:30:00Z', '2026-10-25'],
		['2026-10-25T22:30:00Z', '2026-10-25'],
		['2026-10-25T23:00:00Z', '2026-10-26'],
		// Passage à l'heure d'été, nuit du 28 au 29 mars 2026.
		['2026-03-28T23:30:00Z', '2026-03-29'],
		['2026-03-29T21:59:00Z', '2026-03-29'],
		['2026-03-29T22:00:00Z', '2026-03-30']
	])('%s → %s', (instant, expected) => {
		expect(todayInParis(new Date(instant))).toBe(expected);
	});
});

describe('addDays', () => {
	it("traverse les changements d'heure, les mois et les années bissextiles", () => {
		expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
		expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
		expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
	});

	it('dayOfWeek', () => {
		expect(dayOfWeek('2026-10-23')).toBe(5); // vendredi
		expect(dayOfWeek('2026-10-25')).toBe(0); // dimanche
	});
});

describe('startOfWeek', () => {
	it.each([
		['2026-10-26', '2026-10-26'], // lundi
		['2026-10-28', '2026-10-26'], // mercredi
		['2026-11-01', '2026-10-26'], // dimanche
		['2027-01-01', '2026-12-28'] // semaine à cheval sur deux années
	])('%s → %s', (date, expected) => {
		expect(startOfWeek(date)).toBe(expected);
	});
});

describe('formatTaskDate', () => {
	it.each([
		// Aujourd'hui = mercredi 28/10/2026.
		['2026-10-27', 'hier'],
		['2026-10-28', "aujourd'hui"],
		['2026-10-29', 'demain'],
		['2026-10-30', 'après-demain'],
		['2026-10-31', '31/10/2026'], // même semaine, mais pas un des quatre libellés
		['2026-10-26', '26/10/2026'], // avant-hier
		['2026-11-02', '02/11/2026'] // semaine suivante
	])('mercredi 28/10/2026 : %s → %s', (date, expected) => {
		expect(formatTaskDate(date, '2026-10-28')).toBe(expected);
	});

	it('un dimanche, le lendemain est dans la semaine suivante', () => {
		expect(formatTaskDate('2026-11-02', '2026-11-01')).toBe('02/11/2026');
		expect(formatTaskDate('2026-10-31', '2026-11-01')).toBe('hier');
	});

	it('un lundi, la veille est dans la semaine précédente', () => {
		expect(formatTaskDate('2026-10-25', '2026-10-26')).toBe('25/10/2026');
		expect(formatTaskDate('2026-10-28', '2026-10-26')).toBe('après-demain');
	});

	it('changement de mois et d’année', () => {
		// Vendredi 30/10 : samedi 31/10 et dimanche 01/11 sont dans la même semaine.
		expect(formatTaskDate('2026-10-31', '2026-10-30')).toBe('demain');
		expect(formatTaskDate('2026-11-01', '2026-10-30')).toBe('après-demain');
		// Mercredi 30/12/2026 : la semaine va jusqu'au dimanche 03/01/2027.
		expect(formatTaskDate('2027-01-01', '2026-12-30')).toBe('après-demain');
		expect(formatTaskDate('2026-12-29', '2027-01-01')).toBe('29/12/2026');
		expect(formatTaskDate('2026-12-31', '2027-01-01')).toBe('hier');
	});

	it("autour des changements d'heure, « aujourd'hui » vient de l'heure de Paris", () => {
		// Nuit du 24 au 25 octobre 2026 (passage à l'heure d'hiver) : dimanche 25 à 00h30.
		const sunday = todayInParis(new Date('2026-10-24T22:30:00Z'));
		expect(formatTaskDate('2026-10-25', sunday)).toBe("aujourd'hui");
		expect(formatTaskDate('2026-10-26', sunday)).toBe('26/10/2026');
		// Samedi 24 à 23h30 (UTC+2).
		const saturday = todayInParis(new Date('2026-10-24T21:30:00Z'));
		expect(formatTaskDate('2026-10-25', saturday)).toBe('demain');
		// Nuit du 28 au 29 mars 2026 (passage à l'heure d'été) : dimanche 29 à 00h30.
		const march = todayInParis(new Date('2026-03-28T23:30:00Z'));
		expect(formatTaskDate('2026-03-28', march)).toBe('hier');
		expect(formatTaskDate('2026-03-30', march)).toBe('30/03/2026');
	});

	it('majuscule pour un libellé seul ; jamais pour une date chiffrée', () => {
		expect(formatTaskDate('2026-10-29', '2026-10-28', { capitalize: true })).toBe('Demain');
		expect(formatTaskDate('2026-10-28', '2026-10-28', { capitalize: true })).toBe("Aujourd'hui");
		expect(formatTaskDate('2026-10-31', '2026-10-28', { capitalize: true })).toBe('31/10/2026');
	});
});

describe('formatDateTitle', () => {
	it('date complète pour le survol', () => {
		expect(formatDateTitle('2026-10-28')).toBe('mercredi 28 octobre 2026');
	});
});
