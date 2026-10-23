import { expect, test, type Page } from '@playwright/test';

// Espace Pro : les tests de tasks.spec.ts créent leurs tâches dans Perso.
async function unlockPro(page: Page) {
	await page.goto('/pro/unlock');
	await page.getByLabel('Mot de passe').fill('e2e-password-pro');
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/pro');
	await page.waitForLoadState('networkidle');
}

async function add(page: Page, text: string) {
	const input = page.getByLabel('Nouvelle tâche');
	await input.focus();
	await input.fill(text);
	await input.press('Enter');
}

test('filtres combinables, tri et mémorisation par espace', async ({ page }) => {
	await unlockPro(page);
	const tag = Math.random().toString(36).slice(2, 8);
	const urgent = `Urgent ${tag}`;
	const minor = `Mineure ${tag}`;
	const dated = `Datée ${tag}`;
	await add(page, `${urgent} !1`);
	await add(page, `${minor} !4`);
	await add(page, `${dated} !1 demain`);

	const row = (title: string) => page.getByRole('listitem').filter({ hasText: title });
	await page.getByRole('searchbox', { name: 'Rechercher' }).fill(tag);
	await expect(page.getByRole('listitem')).toHaveCount(3);

	// Priorité 1 ET sans date.
	await page.getByRole('button', { name: 'Filtres' }).click();
	await page.getByRole('button', { name: 'Priorité 1 · Critique Critique' }).click();
	await expect(row(minor)).toHaveCount(0);
	await page.getByRole('button', { name: 'Sans date' }).click();
	await expect(page.getByRole('listitem')).toHaveCount(1);
	await expect(row(urgent)).toBeVisible();
	await expect(page.getByRole('button', { name: /Filtres\s*2/ })).toBeVisible();

	// Après rechargement : filtres et tri conservés, recherche oubliée.
	await page.getByRole('combobox', { name: 'Trier' }).selectOption('alpha');
	await page.waitForLoadState('networkidle');
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByRole('searchbox', { name: 'Rechercher' })).toHaveValue('');
	await expect(page.getByRole('combobox', { name: 'Trier' })).toHaveValue('alpha');
	await expect(row(urgent)).toBeVisible();
	await expect(row(minor)).toHaveCount(0);
	await expect(row(dated)).toHaveCount(0);

	// Mémorisation propre à l'espace : Perso n'est pas filtré.
	await page.goto('/perso/unlock');
	await page.getByLabel('Mot de passe').fill('e2e-password-perso');
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/perso');
	await expect(page.getByRole('button', { name: 'Filtres', exact: true })).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Trier' })).toHaveValue('default');

	// Retour sur Pro et réinitialisation.
	await page.getByRole('link', { name: 'Pro' }).click();
	await expect(page).toHaveURL('/pro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Filtres/ }).click();
	await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
	await page.getByRole('searchbox', { name: 'Rechercher' }).fill(tag);
	await expect(page.getByRole('listitem')).toHaveCount(3);
	// Tri alphabétique conservé.
	await expect(page.getByRole('listitem').first()).toContainText(dated);
});
