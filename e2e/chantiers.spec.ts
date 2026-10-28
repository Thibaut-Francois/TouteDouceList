import { expect, test, type Page } from '@playwright/test';
import { addDays, todayInParis } from '../src/lib/dates';
import { openProfile } from './helpers';

const ok = (page: Page, method: string) =>
	page.waitForResponse((r) => r.request().method() === method && r.url().includes('/projects') && r.ok());

async function addStage(page: Page, name: string, start: string, end: string) {
	await page.getByRole('button', { name: 'Ajouter une étape' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle étape' });
	await dialog.getByLabel('Nom').fill(name);
	await dialog.getByLabel('Début').fill(start);
	await dialog.getByLabel('Fin').fill(end);
	const saved = ok(page, 'POST');
	await dialog.getByRole('button', { name: 'Ajouter' }).click();
	await saved;
	await expect(dialog).toBeHidden();
	await page.waitForLoadState('networkidle');
}

test('chantier : étapes, tâche attribuée à Philippe, cochée partout, terminé puis restauré', async ({
	page,
	isMobile
}) => {
	const tag = Math.random().toString(36).slice(2, 8);
	const name = `Rénovation ${tag}`;
	const task = `Poser placo ${tag}`;
	const today = todayInParis();

	await openProfile(page, 'thibaut');
	await page.getByRole('link', { name: 'Chantiers' }).click();
	await expect(page).toHaveURL('/thibaut/chantiers');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Nouveau chantier' }).click();
	const create = page.getByRole('dialog', { name: 'Nouveau chantier' });
	await create.getByLabel('Nom').fill(name);
	await create.getByRole('button', { name: 'Créer' }).click();
	await expect(page).toHaveURL(/\/thibaut\/chantiers\/[0-9a-f-]{36}$/);
	const projectUrl = page.url();
	await page.waitForLoadState('networkidle');

	// Deux étapes, puis la seconde remonte en premier.
	await addStage(page, 'Placo', today, addDays(today, 6));
	await addStage(page, 'Démolition', addDays(today, -7), addDays(today, -1));
	const stages = page.getByRole('list', { name: 'Étapes' }).locator(':scope > li');
	await expect(stages).toHaveCount(2);
	await expect(stages.nth(1)).toContainText('Démolition');

	const reordered = ok(page, 'PUT');
	if (isMobile) await page.getByRole('button', { name: 'Monter « Démolition »' }).tap();
	else await stages.nth(1).dragTo(stages.nth(0));
	await expect(stages.nth(0)).toContainText('Démolition');
	await reordered;
	await page.reload({ waitUntil: 'networkidle' });
	await expect(stages.nth(0)).toContainText('Démolition');
	await expect(stages.nth(1)).toContainText('Placo');

	// Création rapide dans l'étape, attribuée à Philippe.
	if (!(await page.getByLabel('Nouvelle tâche dans « Placo »').isVisible())) {
		await page.getByRole('button', { name: /^Placo/ }).click();
	}
	const input = page.getByLabel('Nouvelle tâche dans « Placo »');
	await input.fill(`${task} @p !1`);
	await expect(page.getByText('Priorité Critique · Pour Philippe')).toBeVisible();
	const created = ok(page, 'POST');
	await input.press('Enter');
	await created;
	const row = stages.nth(1).getByRole('listitem').filter({ hasText: task });
	await expect(row).toContainText('Philippe');

	// Filtre : la tâche de Philippe disparaît quand on n'affiche que Thibaut.
	await page.getByRole('group', { name: 'Tâches affichées' }).getByRole('button', { name: 'Thibaut' }).click();
	await expect(row).toHaveCount(0);
	await page.getByRole('group', { name: 'Tâches affichées' }).getByRole('button', { name: 'Toutes' }).click();
	await expect(row).toBeVisible();

	// Dans la liste de Philippe, avec son badge ; cochée là-bas…
	await openProfile(page, 'philippe');
	const item = page.getByRole('listitem').filter({ hasText: task });
	await expect(item).toContainText(`${name} › Placo`);
	const done = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok());
	await item.getByRole('checkbox').click();
	await done;

	// … elle est cochée dans le chantier, où tout est désormais fait.
	await page.goto(projectUrl, { waitUntil: 'networkidle' });
	// Toutes les étapes sont terminées : aucune n'est dépliée d'office.
	await page.getByRole('button', { name: /^Placo/ }).click();
	await expect(page.getByRole('checkbox', { name: `Rouvrir « ${task} »` })).toHaveAttribute('aria-checked', 'true');
	const finished = ok(page, 'PATCH');
	await page.getByRole('button', { name: 'Marquer terminé' }).click();
	await finished;
	await expect(page.getByText(/Chantier terminé/)).toBeVisible();

	// Dans l'archive, section « Chantiers terminés » ; restauration.
	await page.goto('/thibaut/archive', { waitUntil: 'networkidle' });
	await page.getByText(/Chantiers terminés/).click();
	await page.getByRole('link', { name }).click();
	await expect(page).toHaveURL(projectUrl);
	await page.waitForLoadState('networkidle');
	const restored = ok(page, 'PATCH');
	await page.getByRole('button', { name: 'Restaurer' }).click();
	await restored;
	await page.goto('/thibaut/chantiers', { waitUntil: 'networkidle' });
	await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
});

test('supprimer une étape qui a des tâches ouvertes : on les déplace', async ({ page }) => {
	const tag = Math.random().toString(36).slice(2, 8);
	const today = todayInParis();
	await openProfile(page, 'philippe');
	await page.goto('/philippe/chantiers', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Nouveau chantier' }).click();
	await page.getByRole('dialog', { name: 'Nouveau chantier' }).getByLabel('Nom').fill(`Salle de bain ${tag}`);
	await page.getByRole('button', { name: 'Créer' }).click();
	await expect(page).toHaveURL(/\/philippe\/chantiers\//);
	await page.waitForLoadState('networkidle');
	await addStage(page, 'Plomberie', today, addDays(today, 3));
	await addStage(page, 'Carrelage', addDays(today, 4), addDays(today, 8));

	const input = page.getByLabel('Nouvelle tâche dans « Plomberie »');
	await input.fill(`Changer le siphon ${tag}`);
	const created = ok(page, 'POST');
	await input.press('Enter');
	await created;
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Modifier l’étape « Plomberie »' }).click();
	const dialog = page.getByRole('dialog', { name: 'Modifier l’étape' });
	await dialog.getByRole('button', { name: 'Supprimer l’étape…' }).click();
	await expect(dialog.getByText('Il reste 1 tâche ouverte.')).toBeVisible();
	await expect(dialog.getByLabel('Étape de destination')).toHaveValue(/.+/);
	const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.ok());
	await dialog.getByRole('button', { name: 'Supprimer l’étape', exact: true }).click();
	await deleted;
	await page.waitForLoadState('networkidle');

	const stages = page.getByRole('list', { name: 'Étapes' }).locator(':scope > li');
	await expect(stages).toHaveCount(1);
	await expect(stages.first()).toContainText('Carrelage');
	if (!(await page.getByText(`Changer le siphon ${tag}`).isVisible())) {
		await page.getByRole('button', { name: /^Carrelage/ }).click();
	}
	await expect(page.getByText(`Changer le siphon ${tag}`)).toBeVisible();
});
