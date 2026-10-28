import { describe, expect, it } from 'vitest';
import { isCachablePage, proProfileOf } from '$lib/offline';

describe('isCachablePage', () => {
	it.each([
		['/perso', true],
		['/thibaut/', true],
		['/perso/__data.json', true],
		['/philippe/recurrences', true],
		['/thibaut/archive/__data.json', true],
		// Jamais : déverrouillage, API, racine, anciennes adresses /pro (redirections), autres chemins.
		['/perso/unlock', false],
		['/perso/unlock/__data.json', false],
		['/api/perso/tasks', false],
		['/', false],
		['/__data.json', false],
		['/pro', false],
		['/pro/archive', false],
		['/personnel', false],
		['/favicon.svg', false]
	])('%s → %s', (path, expected) => {
		expect(isCachablePage(path)).toBe(expected);
	});
});

describe('proProfileOf', () => {
	it.each([
		['/thibaut', 'thibaut'],
		['/philippe/archive/__data.json', 'philippe'],
		['/perso', undefined],
		['/api/thibaut/tasks', undefined]
	])('%s → %s', (path, expected) => {
		expect(proProfileOf(path)).toBe(expected);
	});
});
