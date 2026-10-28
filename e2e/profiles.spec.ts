import { expect, test, type Page } from '@playwright/test';
import { openProfile } from './helpers';

async function add(page: Page, text: string) {
	const input = page.getByLabel('Nouvelle tâche');
	await input.focus();
	await input.fill(text);
	const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
	await input.press('Enter');
	await created;
	// Sur mobile, le champ ouvert recouvre l'en-tête.
	await input.press('Escape');
}

test('Thibaut et Philippe : listes séparées, bascule sur la même section', async ({ page }) => {
	const tag = Math.random().toString(36).slice(2, 8);
	await openProfile(page, 'thibaut');
	await add(page, `Devis ${tag}`);

	const profiles = page.getByRole('navigation', { name: 'Profils' });
	await expect(profiles.getByRole('link', { name: 'Thibaut' })).toHaveAttribute('aria-current', 'page');
	await profiles.getByRole('link', { name: 'Philippe' }).click();
	await expect(page).toHaveURL('/philippe');
	await page.waitForLoadState('networkidle');
	await expect(page.getByText(`Devis ${tag}`)).toHaveCount(0);
	await add(page, `Chantier ${tag}`);

	// La bascule garde la section ouverte.
	await page.getByRole('link', { name: 'Archive' }).click();
	await expect(page).toHaveURL('/philippe/archive');
	await profiles.getByRole('link', { name: 'Thibaut' }).click();
	await expect(page).toHaveURL('/thibaut/archive');

	await page.getByRole('link', { name: 'Tâches' }).click();
	await expect(page).toHaveURL('/thibaut');
	await expect(page.getByText(`Devis ${tag}`)).toBeVisible();
	await expect(page.getByText(`Chantier ${tag}`)).toHaveCount(0);
});

test('le dernier profil utilisé est rouvert, y compris depuis les anciennes adresses /pro', async ({ page }) => {
	await openProfile(page, 'philippe');
	await page.goto('/');
	await expect(page).toHaveURL('/philippe');
	await page.goto('/pro/recurrences');
	await expect(page).toHaveURL('/philippe/recurrences');

	await openProfile(page, 'thibaut');
	await page.goto('/pro');
	await expect(page).toHaveURL('/thibaut');
});

test('filtres et tri mémorisés par profil', async ({ page }) => {
	await openProfile(page, 'philippe');
	const sort = page.getByRole('combobox', { name: 'Trier' });
	await sort.selectOption('alpha');
	await page.waitForLoadState('networkidle');

	await openProfile(page, 'thibaut');
	await expect(sort).toHaveValue('default');
	await openProfile(page, 'philippe');
	await expect(sort).toHaveValue('alpha');
});
