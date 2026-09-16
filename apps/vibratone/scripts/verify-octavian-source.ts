import { realpath } from 'node:fs/promises';
import * as path from 'node:path';

import { createServer } from 'vite';

const applicationRoot = path.resolve(import.meta.dirname, '..');
const workspaceRoot = path.resolve(applicationRoot, '../..');
const expectedEntry = await realpath(path.join(workspaceRoot, 'packages/octavian/src/index.ts'));
const server = await createServer({
	configFile: path.join(applicationRoot, 'vite.config.ts'),
	root: applicationRoot,
	server: { middlewareMode: true }
});

try {
	const resolvedEntry = await server.environments.client.pluginContainer.resolveId(
		'octavian',
		path.join(applicationRoot, 'src/lib/music.ts')
	);
	const resolvedPath = resolvedEntry?.id.split('?')[0];

	if (!resolvedPath) {
		throw new Error('Vite could not resolve the octavian workspace dependency.');
	}

	const actualEntry = await realpath(resolvedPath);
	if (actualEntry !== expectedEntry) {
		throw new Error(`Expected octavian to resolve to ${expectedEntry}, received ${actualEntry}.`);
	}

	process.stdout.write(`Vibratone resolves octavian to ${actualEntry}.\n`);
} finally {
	await server.close();
}
