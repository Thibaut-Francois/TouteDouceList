import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, formatDue, todayInParis } from '$lib/dates';

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

describe('formatDue', () => {
	const today = '2026-10-23';
	it.each([
		['2026-10-23', "Aujourd'hui"],
		['2026-10-24', 'Demain'],
		['2026-10-22', 'Hier'],
		['2026-10-26', 'lundi']
	])('%s → %s', (date, expected) => {
		expect(formatDue(date, today)).toBe(expected);
	});

	it("affiche l'année seulement si elle diffère", () => {
		expect(formatDue('2026-12-25', today)).not.toMatch(/2026/);
		expect(formatDue('2027-01-15', today)).toMatch(/2027/);
	});
});
