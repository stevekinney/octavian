import { spawnSync } from 'node:child_process';

const mode = process.argv[2];

if (mode !== 'production' && mode !== 'development') {
	console.error('Usage: bun scripts/run-playwright-project.ts <production|development>');
	process.exit(1);
}

const executable = process.platform === 'win32' ? 'bun.cmd' : 'bun';
const environment = { ...process.env };
delete environment.NO_COLOR;
const result = spawnSync(executable, ['x', 'playwright', 'test', `--project=${mode}`], {
	stdio: 'inherit',
	env: {
		...environment,
		VIBRATONE_E2E_MODE: mode
	}
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
