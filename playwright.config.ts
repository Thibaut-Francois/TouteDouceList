import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4174;

// Une base neuve par lancement ; les workers héritent de la variable définie par le processus principal.
process.env.E2E_DB ??= join(tmpdir(), `toutedoucelist-e2e-${Date.now()}.db`).replaceAll('\\', '/');

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	use: { baseURL: `http://localhost:${PORT}` },
	projects: [
		{ name: 'pc', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: {
		command: `npm run setup && npx vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: false,
		env: {
			DATABASE_URL: `file:${process.env.E2E_DB}`,
			PASSWORD_PRO: 'e2e-password-pro',
			PASSWORD_PERSO: 'e2e-password-perso'
		}
	}
});
