import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEV_PORT = 4174;
const PREVIEW_PORT = 4175;

// Bases neuves par lancement ; les workers héritent des variables définies par le processus principal.
const stamp = Date.now();
process.env.E2E_DB ??= join(tmpdir(), `toutedoucelist-e2e-${stamp}.db`).replaceAll('\\', '/');
process.env.E2E_PREVIEW_DB ??= join(tmpdir(), `toutedoucelist-e2e-preview-${stamp}.db`).replaceAll('\\', '/');

// Les tests PWA (service worker, hors ligne) tournent sur un build de production :
// en dev, Vite sert le JS module par module, hors du précache.
const PWA_TESTS = /offline\.spec\.ts/;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	projects: [
		{
			name: 'pc',
			testIgnore: PWA_TESTS,
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` }
		},
		{
			name: 'mobile',
			testIgnore: PWA_TESTS,
			use: { ...devices['Pixel 7'], baseURL: `http://localhost:${DEV_PORT}` }
		},
		{
			name: 'pwa',
			testMatch: PWA_TESTS,
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` }
		}
	],
	webServer: [
		{
			command: `npm run setup && npx vite dev --port ${DEV_PORT} --strictPort`,
			url: `http://localhost:${DEV_PORT}`,
			reuseExistingServer: false,
			// Les erreurs serveur (5xx) apparaissent dans la sortie des tests.
			stdout: 'pipe',
			stderr: 'pipe',
			env: { DATABASE_URL: `file:${process.env.E2E_DB}` }
		},
		{
			command: `npm run setup && npx vite build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
			url: `http://localhost:${PREVIEW_PORT}`,
			reuseExistingServer: false,
			timeout: 180_000,
			stderr: 'pipe',
			env: { DATABASE_URL: `file:${process.env.E2E_PREVIEW_DB}`, E2E_PREVIEW: '1' }
		}
	]
});
