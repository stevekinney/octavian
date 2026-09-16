import { defineConfig } from '@playwright/test';

const productionServer = {
	command: 'bun run build && bun run preview -- --host 127.0.0.1 --port 4173',
	port: 4173
};

const developmentServer = {
	command: 'bun run dev -- --host 127.0.0.1 --port 4174',
	port: 4174
};

const webServer =
	process.env.VIBRATONE_E2E_MODE === 'production'
		? [productionServer]
		: process.env.VIBRATONE_E2E_MODE === 'development'
			? [developmentServer]
			: (() => {
					throw new Error(
						'Set VIBRATONE_E2E_MODE to production or development before running Playwright.'
					);
				})();

export default defineConfig({
	webServer,
	testMatch: '**/*.e2e.{ts,js}',
	projects: [
		{
			name: 'production',
			testIgnore: '**/*.dev.e2e.{ts,js}',
			use: { baseURL: 'http://127.0.0.1:4173' }
		},
		{
			name: 'development',
			testMatch: '**/*.dev.e2e.{ts,js}',
			use: { baseURL: 'http://127.0.0.1:4174' }
		}
	]
});
