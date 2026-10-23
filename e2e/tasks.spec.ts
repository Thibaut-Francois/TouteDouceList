import { expect, test, type Page } from '@playwright/test';
import { todayCode, unlockPerso as unlock } from './helpers';

async function reload(page: Page) {
	await page.reload({ waitUntil: 'networkidle' });
}

/** Réponse réussie d'une écriture : à attendre avant de recharger, sinon le rechargement l'annule. */
function saved(page: Page, method: string, bodyContains = '') {
	return page.waitForResponse(
		(r) =>
			r.request().method() === method &&
			(r.request().postData() ?? '').includes(bodyContains) &&
			r.ok()
	);
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
	const created = saved(page, 'POST');
	await page.keyboard.press('Enter');

	const item = page.getByRole('listitem').filter({ hasText: title });
	await expect(item).toContainText('Demain');
	await expect(item.getByRole('img', { name: 'Priorité 1 · Critique' })).toHaveText('1');
	await expect(page.getByLabel('Nouvelle tâche')).toHaveValue('');

	await created;
	await reload(page);
	await expect(item).toBeVisible();

	await item.getByRole('checkbox').click();
	await expect(item).toHaveCount(0);
	const reopened = saved(page, 'PATCH', '"open"');
	await page.getByRole('button', { name: 'Annuler' }).click();
	await expect(item).toBeVisible();

	await reopened;
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
	const completed = saved(page, 'PATCH', '"done"');
	await item.getByRole('checkbox').click();
	await expect(item).toHaveCount(0);
	await completed;
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
	const edited = saved(page, 'PATCH', 'annexes');
	await dialog.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(dialog).toBeHidden();

	const item = page.getByRole('listitem').filter({ hasText: `${title} relu` });
	const badge = item.getByRole('img', { name: 'Priorité 2 · Élevée' });
	await expect(badge).toBeVisible();
	await expect(item).toContainText('2030');

	await edited;
	await reload(page);
	await expect(badge).toBeVisible();
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

test('au lancement : choix de l’espace ; Pro s’ouvre directement, Perso demande le code du jour', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Pro' }).click();
	await expect(page).toHaveURL('/pro');
	await expect(page.getByRole('button', { name: 'Verrouiller' })).toHaveCount(0);

	await page.goto('/');
	await page.getByRole('link', { name: 'Perso' }).click();
	await expect(page).toHaveURL('/perso/unlock');
	await page.waitForLoadState('networkidle');
	// Pas de mauvais code ici : les échecs depuis l'IP de test bloqueraient Perso pour
	// les autres tests (limiteur). Ce cas est couvert par tests/auth.test.ts.
	await page.getByLabel('Code').fill(todayCode());
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/perso');
	await expect(page.getByRole('button', { name: 'Verrouiller' })).toBeVisible();

	// Pro n'a pas de page de déverrouillage.
	await page.goto('/pro/unlock');
	await expect(page).toHaveURL('/pro');
});
