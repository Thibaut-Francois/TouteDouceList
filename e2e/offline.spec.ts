import { expect, test } from '@playwright/test';
import { unlockPerso } from './helpers';

// Tourne sur le serveur de preview, avec sa propre base : verrouiller Perso ne gêne pas les autres tests.

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
	await unlockPerso(page);
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
	await expect(page).toHaveURL('/pro');
	await page.waitForLoadState('networkidle');

	await context.setOffline(true);
	await page.goto('/perso').catch(() => {});
	await expect(page.getByText("Cette page n'a pas encore été consultée sur cet appareil.")).toBeVisible();
	await expect(page.getByText(title)).toHaveCount(0);
	await context.setOffline(false);
});

test('hors ligne, le lancement de l’app (/) ouvre la dernière liste Pro', async ({ page, context }) => {
	await page.goto('/');
	await expect(page).toHaveURL('/pro');
	await page.evaluate(() => navigator.serviceWorker.ready);
	// Rechargement contrôlé par le service worker : la liste Pro est mise en cache.
	await page.reload({ waitUntil: 'networkidle' });

	await context.setOffline(true);
	await page.goto('/');
	await expect(page).toHaveURL('/pro');
	await expect(page.getByText('Hors ligne · lecture seule')).toBeVisible();
	await context.setOffline(false);
});
