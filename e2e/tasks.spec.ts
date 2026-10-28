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
	// Sur téléphone, aucun champ n'a le focus à l'ouverture : le clavier reste fermé.
	if (isMobile) await expect(dialog).toBeFocused();
	else await expect(dialog.getByLabel('Titre')).toBeFocused();
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

test('niveau d’urgence choisi à la création, puis retour à « Faible »', async ({ page, isMobile }) => {
	await unlock(page);
	const input = page.getByLabel('Nouvelle tâche');
	await expect(input).toHaveAttribute('placeholder', 'Nouvelle tâche');

	const urgent = unique('Appeler le notaire');
	await openQuickAdd(page, isMobile);
	await page.keyboard.type(urgent);
	const picker = (n: number, label: string) => page.getByRole('button', { name: `Urgence ${n} · ${label}` });
	await expect(picker(3, 'Faible')).toHaveAttribute('aria-pressed', 'true');
	await picker(2, 'Élevée').click();
	// Le champ garde le focus : sur mobile, la surcouche reste ouverte.
	await expect(input).toBeFocused();
	await expect(picker(2, 'Élevée')).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Enter');

	const item = page.getByRole('listitem').filter({ hasText: urgent });
	await expect(item.getByRole('img', { name: 'Priorité 2 · Élevée' })).toBeVisible();
	await expect(picker(3, 'Faible')).toHaveAttribute('aria-pressed', 'true');

	// La syntaxe l'emporte sur le sélecteur.
	const critical = unique('Fuite d’eau');
	await page.keyboard.type(`${critical} !1`);
	await expect(picker(1, 'Critique')).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Enter');
	await expect(
		page.getByRole('listitem').filter({ hasText: critical }).getByRole('img', { name: 'Priorité 1 · Critique' })
	).toBeVisible();
});

test('un clic à côté ferme la fenêtre de modification (sans enregistrer) et le panneau de filtres', async ({
	page,
	isMobile
}) => {
	await unlock(page);
	const title = unique('Clic dehors');
	await openQuickAdd(page, isMobile);
	await page.keyboard.type(title);
	await page.keyboard.press('Enter');

	await page.getByRole('button', { name: title }).click();
	const dialog = page.getByRole('dialog', { name: 'Modifier la tâche' });
	await dialog.getByLabel('Titre').fill(`${title} modifié`);
	await page.mouse.click(4, 4);
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('listitem').filter({ hasText: `${title} modifié` })).toHaveCount(0);

	// Un clic dans la fenêtre (sur un libellé) ne la ferme pas.
	await page.getByRole('button', { name: title }).click();
	await dialog.getByText('Notes', { exact: true }).click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	const filters = page.getByRole('button', { name: 'Filtres' });
	await filters.click();
	await expect(filters).toHaveAttribute('aria-expanded', 'true');
	// Le clic dehors (sur l'onglet Récurrences) ferme le panneau sans rien déclencher dessous.
	await page.getByRole('link', { name: 'Récurrences' }).click({ force: true });
	await expect(filters).toHaveAttribute('aria-expanded', 'false');
	await expect(page).toHaveURL('/perso');
	await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();

	await filters.click();
	await page.keyboard.press('Escape');
	await expect(filters).toHaveAttribute('aria-expanded', 'false');
});

test('au lancement : Pro directement, sans lien vers Perso ; /perso demande le code du jour', async ({
	page
}) => {
	await page.goto('/');
	await expect(page).toHaveURL('/pro');
	await expect(page.getByRole('button', { name: 'Verrouiller' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Perso' })).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Espaces' })).toHaveCount(0);

	await page.goto('/perso');
	await expect(page).toHaveURL('/perso/unlock');
	await page.waitForLoadState('networkidle');
	// Pas de mauvais code ici : les échecs depuis l'IP de test bloqueraient Perso pour
	// les autres tests (limiteur). Ce cas est couvert par tests/auth.test.ts.
	await page.getByLabel('Code').fill(todayCode());
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/perso');
	await expect(page.getByRole('button', { name: 'Verrouiller' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Perso' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Pro' })).toBeVisible();

	// Pro n'a pas de page de déverrouillage.
	await page.goto('/pro/unlock');
	await expect(page).toHaveURL('/pro');
});

test('sur téléphone, le code Perso se tape sur le pavé de la page', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'Pavé affiché sur téléphone seulement');
	await page.goto('/perso/unlock');
	await page.waitForLoadState('networkidle');

	const keypad = page.getByRole('group', { name: 'Pavé numérique' });
	await expect(page.getByLabel('Code')).toHaveAttribute('inputmode', 'none');
	const [first, ...rest] = todayCode();
	await keypad.getByRole('button', { name: first, exact: true }).tap();
	await keypad.getByRole('button', { name: '9', exact: true }).tap();
	await keypad.getByRole('button', { name: 'Effacer' }).tap();
	await expect(page.getByLabel('Code')).toHaveValue(first);

	// Validation automatique au 4e chiffre.
	for (const digit of rest) await keypad.getByRole('button', { name: digit, exact: true }).tap();
	await expect(page).toHaveURL('/perso');
});
