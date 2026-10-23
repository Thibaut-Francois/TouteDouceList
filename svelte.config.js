import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Paris, au plus près de la base Turso.
		adapter: adapter({ regions: ['cdg1'] })
	}
};

export default config;
