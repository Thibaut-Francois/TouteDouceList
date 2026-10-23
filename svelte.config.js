import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Production : Vercel, Paris, au plus près de la base Turso.
		// Tests e2e sur build de production (PWA) : adapter Node, car l'adapter Vercel
		// échoue sous Windows sans le mode développeur (liens symboliques).
		adapter: process.env.E2E_PREVIEW ? nodeAdapter() : vercelAdapter({ regions: ['cdg1'] })
	}
};

export default config;
