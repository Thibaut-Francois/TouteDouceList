import { expect, test, type Page } from '@playwright/test';

async function unlock(page: Page) {
	await page.goto('/perso/unlock');
	await page.getByLabel('Mot de passe').fill('e2e-password-perso');
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/perso');
	await page.waitForLoadState('networkidle');
}

async function addAndComplete(page: Page, title: string) {
	const input = page.getByLabel('Nouvelle tâche');
	await input.focus();
	await input.fill(title);
	const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
	await input.press('Enter');
	await created;
	const completed = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok());
	await page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox').click();
	await completed;
}

test('archive : recherche, réouverture et suppression définitive', async ({ page }) => {
	await unlock(page);
	const tag = Math.random().toString(36).slice(2, 8);
	const kept = `Réunion bilan ${tag}`;
	const removed = `Brouillon jetable ${tag}`;
	await addAndComplete(page, kept);
	await addAndComplete(page, removed);

	await page.getByRole('link', { name: 'Archive' }).click();
	await expect(page).toHaveURL('/perso/archive');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible();

	// Recherche sans accent : « reunion » trouve « Réunion ».
	await page.getByRole('searchbox', { name: "Rechercher dans l'archive" }).fill(`reunion ${tag}`);
	await expect(page).toHaveURL(new RegExp(`q=reunion`));
	const rows = page.getByRole('listitem');
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText(kept);

	// Rouvrir : la tâche revient dans Tâches.
	await page.getByRole('button', { name: `Rouvrir « ${kept} »` }).click();
	await expect(rows).toHaveCount(0);
	await expect(page.getByText('Aucune tâche terminée ne correspond.')).toBeVisible();

	// Suppression définitive, avec confirmation et possibilité d'annuler.
	await page.getByRole('searchbox', { name: "Rechercher dans l'archive" }).fill(tag);
	const row = page.getByRole('listitem').filter({ hasText: removed });
	await expect(row).toBeVisible();
	await page.getByRole('button', { name: `Supprimer « ${removed} »` }).click();
	await row.getByRole('button', { name: 'Annuler' }).click();
	await expect(row).toBeVisible();
	await page.getByRole('button', { name: `Supprimer « ${removed} »` }).click();
	const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.ok());
	await row.getByRole('button', { name: 'Supprimer', exact: true }).click();
	await deleted;
	await expect(row).toHaveCount(0);

	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByRole('searchbox', { name: "Rechercher dans l'archive" })).toHaveValue(tag);
	await expect(page.getByRole('listitem')).toHaveCount(0);

	await page.getByRole('link', { name: 'Tâches' }).click();
	await expect(page).toHaveURL('/perso');
	await expect(page.getByRole('listitem').filter({ hasText: kept })).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: removed })).toHaveCount(0);
});
