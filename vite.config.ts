import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	// Le point d'entrée Node de rrule est en CommonJS (imports nommés impossibles en SSR) :
	// Vite le traite lui-même à partir de son build ESM.
	ssr: { noExternal: ['rrule'] },
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		environment: 'node',
		globalSetup: ['tests/global-setup.ts']
	}
});
