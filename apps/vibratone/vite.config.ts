import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { defaultClientConditions, defaultServerConditions } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['source', ...defaultClientConditions]
	},
	optimizeDeps: {
		include: [
			'vexflow/bravura',
			'@lostgradient/cinder/dropdown',
			'lucide-svelte/icons/activity',
			'lucide-svelte/icons/check',
			'lucide-svelte/icons/flame',
			'lucide-svelte/icons/play',
			'lucide-svelte/icons/rotate-ccw',
			'lucide-svelte/icons/square',
			'lucide-svelte/icons/x'
		]
	},
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [{ name: 'notation-fonts', test: /vexflow\/build\/esm\/src\/fonts\// }]
				}
			}
		}
	},
	ssr: {
		noExternal: ['lucide-svelte'],
		resolve: {
			conditions: ['source', ...defaultServerConditions]
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
