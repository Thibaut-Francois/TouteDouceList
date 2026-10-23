import { expect, test, type Page } from '@playwright/test';

// Espace Pro : le test le verrouille, ce qui ne doit pas gêner les tests de Perso.
async function unlockPro(page: Page) {
	await page.goto('/pro/unlock');
	await page.getByLabel('Mot de passe').fill('e2e-password-pro');
	await page.getByRole('button', { name: 'Déverrouiller' }).click();
	await expect(page).toHaveURL('/pro');
	await page.waitForLoadState('networkidle');
}

test('manifeste et icônes de la PWA', async ({ request }) => {
	const manifest = await (await request.get('/manifest.webmanifest')).json();
	expect(manifest).toMatchObject({ name: 'TouteDouceList', start_url: '/', display: 'standalone' });
	for (const icon of manifest.icons) {
		const res = await request.get(icon.src);
		expect(res.status(), icon.src).toBe(200);
		expect(res.headers()['content-type']).toContain('image/png');
	}
});

test('hors ligne : dernière liste lisible, écriture désactivée ; le verrouillage efface la copie', async ({
	page,
	context
}) => {
	await unlockPro(page);
	await page.evaluate(() => navigator.serviceWorker.ready);

	const title = `Hors ligne ${Math.random().toString(36).slice(2, 8)}`;
	const input = page.getByLabel('Nouvelle tâche');
	await input.focus();
	await input.fill(title);
	const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
	await input.press('Enter');
	await created;
	// Rechargement contrôlé par le service worker : la page est mise en cache.
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();
	await expect(page.getByText('Hors ligne · lecture seule')).toBeVisible();
	await expect(page.getByLabel('Nouvelle tâche')).toBeDisabled();
	await expect(
		page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox')
	).toBeDisabled();

	await context.setOffline(false);
	await expect(page.getByText('Hors ligne · lecture seule')).toBeHidden();
	await expect(page.getByLabel('Nouvelle tâche')).toBeEnabled();

	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Verrouiller' }).click();
	await expect(page).toHaveURL('/pro/unlock');
	await page.waitForLoadState('networkidle');

	await context.setOffline(true);
	await page.goto('/pro').catch(() => {});
	await expect(page.getByText("Cette page n'a pas encore été consultée sur cet appareil.")).toBeVisible();
	await expect(page.getByText(title)).toHaveCount(0);
	await context.setOffline(false);
});
