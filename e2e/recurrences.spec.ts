import { expect, test, type Page } from '@playwright/test';
import { unlockPerso } from './helpers';

const unlock = unlockPerso;

async function goTo(page: Page, tab: 'Tâches' | 'Récurrences', url: string) {
	await page.getByRole('link', { name: tab }).click();
	await expect(page).toHaveURL(url);
	await page.waitForLoadState('networkidle');
}

test('récurrence : création, occurrence du jour, pause et suppression', async ({ page }) => {
	await unlock(page);
	const title = `Arroser ${Math.random().toString(36).slice(2, 8)}`;

	await goTo(page, 'Récurrences', '/perso/recurrences');
	await page.getByRole('button', { name: 'Nouvelle récurrence' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle récurrence' });
	await dialog.getByLabel('Titre').fill(title);
	await dialog.getByLabel('Rythme').selectOption('daily');
	await dialog.getByLabel('Priorité').selectOption('2');
	await expect(dialog.getByRole('list', { name: 'Prochaines dates' }).getByRole('listitem')).toHaveCount(5);
	await dialog.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(dialog).toBeHidden();

	const row = page.getByRole('listitem').filter({ hasText: title });
	await expect(row).toContainText('Tous les jours');

	// L'occurrence du jour est générée à l'ouverture de la liste.
	await goTo(page, 'Tâches', '/perso');
	const occurrence = page.getByRole('listitem').filter({ hasText: title });
	await expect(occurrence).toContainText("Aujourd'hui");
	await expect(occurrence.getByLabel('Récurrente')).toBeVisible();
	await expect(occurrence.getByRole('img', { name: 'Priorité 2 · Élevée' })).toBeVisible();

	// Le filtre « Récurrente » la garde.
	await page.getByRole('button', { name: 'Filtres' }).click();
	await page.getByRole('button', { name: 'Récurrente', exact: true }).click();
	await expect(occurrence).toBeVisible();
	await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();

	// Pause, puis suppression avec son occurrence ouverte.
	await goTo(page, 'Récurrences', '/perso/recurrences');
	await row.getByRole('button', { name: 'Mettre en pause' }).click();
	await expect(row).toContainText('En pause');
	await row.getByRole('button', { name: title }).click();
	await page.getByRole('dialog', { name: 'Modifier la récurrence' }).getByRole('button', { name: 'Supprimer' }).click();
	const confirm = page.getByRole('dialog', { name: `Supprimer « ${title} » ?` });
	await expect(confirm.getByLabel('Supprimer aussi son occurrence en cours')).toBeChecked();
	await confirm.getByRole('button', { name: 'Supprimer', exact: true }).click();
	await expect(row).toHaveCount(0);

	await goTo(page, 'Tâches', '/perso');
	await expect(occurrence).toHaveCount(0);
});

test('récurrence : les formulaires des préréglages s’adaptent', async ({ page }) => {
	await unlock(page);
	await goTo(page, 'Récurrences', '/perso/recurrences');
	await page.getByRole('button', { name: 'Nouvelle récurrence' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle récurrence' });

	await dialog.getByLabel('Rythme').selectOption('monthly-day');
	await dialog.getByLabel('Jour du mois').selectOption('31');
	await expect(dialog.getByText('Les mois plus courts, ce sera le dernier jour du mois.')).toBeVisible();

	await dialog.getByLabel('Rythme').selectOption('monthly-nth');
	await dialog.getByLabel('Le', { exact: true }).selectOption('-1');
	await expect(dialog.getByLabel('Jour du mois')).toHaveCount(0);
	await dialog.getByLabel('Jour', { exact: true }).selectOption('FR');
	const dates = dialog.getByRole('list', { name: 'Prochaines dates' }).getByRole('listitem');
	await expect(dates).toHaveCount(5);
	await expect(dates.first()).toContainText('ven.');

	await dialog.getByLabel('Rythme').selectOption('custom');
	await dialog.getByLabel('Tous les').fill('2');
	await dialog.getByLabel('Unité').selectOption('week');
	await dialog.getByRole('button', { name: 'lundi' }).click();
	await expect(dates).toHaveCount(5);

	await dialog.getByRole('button', { name: 'Annuler' }).click();
	await expect(dialog).toBeHidden();
});
