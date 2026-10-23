import { describe, expect, it } from 'vitest';
import { isValidDate, parseNewTask, parseTaskPatch } from '$lib/server/validate';

const id = '0b7c8c1e-9a5f-4a57-9f3e-2f1d6c0a7b11';

describe('parseNewTask', () => {
	it('applique les valeurs par défaut', () => {
		expect(parseNewTask({ id, title: '  Acheter du pain  ' })).toEqual({
			id,
			title: 'Acheter du pain',
			notes: '',
			priority: 3,
			dueDate: null
		});
	});

	it.each([
		{ id: 'pas-un-uuid', title: 'x' },
		{ id, title: '   ' },
		{ id, title: 'x', priority: 5 },
		{ id, title: 'x', priority: 1.5 },
		{ id, title: 'x', dueDate: '2026-02-30' }
	])('rejette %o', (body) => {
		expect(() => parseNewTask(body)).toThrow();
	});
});

describe('parseTaskPatch', () => {
	it('ne garde que les champs fournis', () => {
		expect(parseTaskPatch({ status: 'done', dueDate: null })).toEqual({ status: 'done', dueDate: null });
	});

	it('rejette un statut inconnu', () => {
		expect(() => parseTaskPatch({ status: 'archived' })).toThrow();
	});
});

describe('isValidDate', () => {
	it.each([
		['2028-02-29', true],
		['2027-02-29', false],
		['2026-13-01', false],
		['2026-1-01', false]
	])('%s → %s', (value, expected) => {
		expect(isValidDate(value)).toBe(expected);
	});
});
