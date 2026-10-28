import { expect, type Page } from '@playwright/test';
import { todayInParis } from '../src/lib/dates';

/** Code du jour de Perso (MMJJ, heure de Paris), comme côté serveur. */
export function todayCode() {
	const [, month, day] = todayInParis().split('-');
	return `${month}${day}`;
}

/** Déverrouille Perso puis attend l'hydratation (en dev, Vite sert les modules un par un). */
export async function unlockPerso(page: Page) {
	await page.goto('/perso');
	await expect(page).toHaveURL('/perso/unlock');
	await page.getByLabel('Code').fill(todayCode());
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/perso');
	await page.waitForLoadState('networkidle');
}

/** Les profils Pro (Thibaut, Philippe) sont en accès libre. */
export async function openProfile(page: Page, profile: 'thibaut' | 'philippe' = 'thibaut') {
	await page.goto(`/${profile}`);
	await expect(page).toHaveURL(`/${profile}`);
	await page.waitForLoadState('networkidle');
}
