import { expect, test, type Page } from '@playwright/test';

async function unlock(page: Page, space = 'perso', password = `e2e-password-${space}`) {
	await page.goto(`/${space}`);
	await expect(page).toHaveURL(`/${space}/unlock`);
	await page.getByLabel('Mot de passe').fill(password);
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL(`/${space}`);
	// Attend l'hydratation (en dev, Vite sert les modules un par un).
	await page.waitForLoadState('networkidle');
}

async function reload(page: Page) {
	await page.reload({ waitUntil: 'networkidle' });
}

/** Sur PC, le raccourci N ; sur mobile, le bouton flottant. Le focus doit suivre immédiatement. */
async function openQuickAdd(page: Page, isMobile: boolean) {
	if (isMobile) await page.getByRole('button', { name: 'Ajouter une tâche' }).tap();
	else await page.keyboard.press('n');
	await expect(page.getByLabel('Nouvelle tâche')).toBeFocused();
}

const unique = (label: string) => `${label} ${Math.random().toString(36).slice(2, 8)}`;

test('création rapide avec syntaxe, complétion et annulation', async ({ page, isMobile }) => {
	await unlock(page);
	const title = unique('Payer facture');

	await openQuickAdd(page, isMobile);
	await page.keyboard.type(`${title} !1 demain`);
	await expect(page.getByText('Priorité Critique · Échéance demain')).toBeVisible();
	await page.keyboard.press('Enter');

	const item = page.getByRole('listitem').filter({ hasText: title });
	await expect(item).toContainText('Demain');
	await expect(item).toContainText('!1');
	await expect(page.getByLabel('Nouvelle tâche')).toHaveValue('');

	await reload(page);
	await expect(item).toBeVisible();

	await item.getByRole('checkbox').click();
	await expect(item).toHaveCount(0);
	await page.getByRole('button', { name: 'Annuler' }).click();
	await expect(item).toBeVisible();

	await reload(page);
	await expect(item).toBeVisible();
});

test('une tâche cochée ne revient pas après rechargement', async ({ page, isMobile }) => {
	await unlock(page);
	const title = unique('Sortir les poubelles');
	await openQuickAdd(page, isMobile);
	await page.keyboard.type(title);
	await page.keyboard.press('Enter');

	const item = page.getByRole('listitem').filter({ hasText: title });
	await item.getByRole('checkbox').click();
	await expect(item).toHaveCount(0);
	// Laisse partir la requête avant de recharger.
	await page.waitForLoadState('networkidle');
	await reload(page);
	await expect(item).toHaveCount(0);
});

test('édition du titre, des notes, de la priorité et de l’échéance', async ({ page, isMobile }) => {
	await unlock(page);
	const title = unique('Brouillon');
	await openQuickAdd(page, isMobile);
	await page.keyboard.type(title);
	await page.keyboard.press('Enter');

	await page.getByRole('button', { name: title }).click();
	const dialog = page.getByRole('dialog', { name: 'Modifier la tâche' });
	await dialog.getByLabel('Titre').fill(`${title} relu`);
	await dialog.getByLabel('Notes').fill('Penser aux annexes');
	await dialog.getByLabel('Priorité').selectOption('2');
	await dialog.getByLabel('Échéance').fill('2030-01-15');
	await dialog.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(dialog).toBeHidden();

	const item = page.getByRole('listitem').filter({ hasText: `${title} relu` });
	await expect(item).toContainText('!2');
	await expect(item).toContainText('2030');

	await reload(page);
	await expect(item).toContainText('!2');
	await page.getByRole('button', { name: `${title} relu` }).click();
	await expect(dialog.getByLabel('Notes')).toHaveValue('Penser aux annexes');
});

test('sans réseau, la tâche reste affichée avec « Réessayer »', async ({ page, isMobile }) => {
	test.slow();
	await unlock(page);
	await page.route('**/api/perso/tasks', (route) => route.abort('internetdisconnected'));

	const title = unique('Hors ligne');
	await openQuickAdd(page, isMobile);
	await page.keyboard.type(title);
	await page.keyboard.press('Enter');

	const item = page.getByRole('listitem').filter({ hasText: title });
	await expect(item).toBeVisible();
	// Après les réessais automatiques (~6 s).
	await expect(item.getByText('Non enregistrée')).toBeVisible({ timeout: 15_000 });

	await page.unroute('**/api/perso/tasks');
	await item.getByRole('button', { name: 'Réessayer' }).click();
	await expect(item.getByText('Non enregistrée')).toBeHidden();

	await reload(page);
	await expect(item).toBeVisible();
});

test('le raccourci N ne se déclenche pas pendant la saisie', async ({ page, isMobile }) => {
	test.skip(isMobile, 'raccourci clavier PC');
	await unlock(page);
	await page.keyboard.press('n');
	await page.keyboard.type('Une tâche avec des n');
	await expect(page.getByLabel('Nouvelle tâche')).toHaveValue('Une tâche avec des n');
});

test('basculer vers un espace verrouillé demande son mot de passe', async ({ page }) => {
	await unlock(page);
	await page.getByRole('link', { name: 'Pro' }).click();
	await expect(page).toHaveURL('/pro/unlock');
	await page.getByLabel('Mot de passe').fill('e2e-password-perso');
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	// Selon le nombre d'essais déjà faits depuis cette IP, le limiteur peut avoir pris le relais.
	await expect(page.getByRole('alert')).toHaveText(/Mot de passe incorrect|Trop de tentatives/);
	await expect(page).toHaveURL('/pro/unlock');
});
