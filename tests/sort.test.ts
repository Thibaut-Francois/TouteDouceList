import { expect, it } from 'vitest';
import { compareDefault } from '$lib/sort';

const today = '2026-10-23';

it('trie en retard, puis priorité, puis échéance (sans date en dernier), puis création', () => {
	const tasks = [
		{ name: 'sans date p3', priority: 3, dueDate: null, createdAt: 1 },
		{ name: 'demain p3', priority: 3, dueDate: '2026-10-24', createdAt: 2 },
		{ name: 'retard p4', priority: 4, dueDate: '2026-10-20', createdAt: 3 },
		{ name: 'auj p1', priority: 1, dueDate: today, createdAt: 4 },
		{ name: 'retard p2', priority: 2, dueDate: '2026-10-22', createdAt: 5 },
		{ name: 'sans date p1', priority: 1, dueDate: null, createdAt: 6 },
		{ name: 'sans date p3 récente', priority: 3, dueDate: null, createdAt: 7 }
	];
	expect(tasks.sort(compareDefault(today)).map((t) => t.name)).toEqual([
		'retard p2',
		'retard p4',
		'auj p1',
		'sans date p1',
		'demain p3',
		'sans date p3',
		'sans date p3 récente'
	]);
});
