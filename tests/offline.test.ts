import { expect, it } from 'vitest';
import { isCachablePage } from '$lib/offline';

it.each([
	['/perso', true],
	['/pro/', true],
	['/perso/__data.json', true],
	['/pro/recurrences', true],
	['/pro/archive/__data.json', true],
	// Jamais : déverrouillage, API, racine, autres chemins.
	['/perso/unlock', false],
	['/perso/unlock/__data.json', false],
	['/api/perso/tasks', false],
	['/', false],
	['/__data.json', false],
	['/personnel', false],
	['/favicon.svg', false]
])('%s → %s', (path, expected) => {
	expect(isCachablePage(path)).toBe(expected);
});
