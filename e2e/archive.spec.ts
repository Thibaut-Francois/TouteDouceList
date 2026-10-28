import { expect, test, type Page } from '@playwright/test';
import { unlockPerso } from './helpers';

const unlock = unlockPerso;

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

test('archive : une tâche s’ouvre sur sa fiche (notes et dates)', async ({ page }) => {
	await unlock(page);
	const title = `Déclaration impôts ${Math.random().toString(36).slice(2, 8)}`;
	const input = page.getByLabel('Nouvelle tâche');
	await input.focus();
	await input.fill(title);
	await input.press('Enter');

	// Notes multilignes et échéance, puis complétion.
	await page.getByRole('button', { name: title }).click();
	const editor = page.getByRole('dialog', { name: 'Modifier la tâche' });
	await editor.getByLabel('Notes').fill('Numéro fiscal dans le classeur.\nAvis 2025 joint.');
	await editor.getByLabel('Échéance').fill('2026-05-20');
	const edited = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok());
	await editor.getByRole('button', { name: 'Enregistrer' }).click();
	await edited;
	const completed = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok());
	await page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox').click();
	await completed;

	await page.getByRole('link', { name: 'Archive' }).click();
	await expect(page).toHaveURL('/perso/archive');
	await page.waitForLoadState('networkidle');

	const openDetail = () => page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
	await openDetail();
	const detail = page.getByRole('dialog', { name: title });
	await expect(detail.getByText('Numéro fiscal dans le classeur.')).toBeVisible();
	await expect(detail.getByText('Avis 2025 joint.')).toBeVisible();
	await expect(detail.getByText('20/05/2026')).toHaveAttribute('title', 'mercredi 20 mai 2026');
	await expect(detail.getByText('Créée le')).toBeVisible();
	await expect(detail.getByText('Terminée le')).toBeVisible();

	// Un clic à côté ferme la fiche.
	await page.mouse.click(4, 4);
	await expect(detail).toBeHidden();

	// Rouvrir depuis la fiche.
	await openDetail();
	await detail.getByRole('button', { name: 'Rouvrir' }).click();
	await expect(detail).toBeHidden();
	await expect(page.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);
});
