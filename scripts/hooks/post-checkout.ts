#!/usr/bin/env bun
import { $ } from 'bun';

import {
  fileChangedBetween,
  header,
  info,
  isContinuousIntegration,
  success,
  warning,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

const [, , prevHead = '', newHead = '', checkoutType = ''] = Bun.argv;
// Only branch checkouts
if (checkoutType !== '1') process.exit(0);
if (prevHead === '0000000000000000000000000000000000000000') process.exit(0);

header('Post-checkout hook');

const rootPackageChanged = await fileChangedBetween('package.json', prevHead, newHead);
const libraryPackageChanged = await fileChangedBetween(
  'packages/octavian/package.json',
  prevHead,
  newHead,
);
const packageChanged = rootPackageChanged || libraryPackageChanged;
const lockChanged = await fileChangedBetween('bun.lock', prevHead, newHead);

if (packageChanged) info('package.json has changed');
if (lockChanged) info('bun.lock has changed');

if (lockChanged) {
  info('Dependencies changed, installing…');
  try {
    await $`bun install`;
    success('Dependencies installed');
    const stat =
      await $`git diff --stat ${prevHead}..${newHead} -- package.json packages/octavian/package.json bun.lock`.text();
    await Bun.write(Bun.stdout, stat);
  } catch {
    warning('Failed to install dependencies — run bun install manually');
  }
} else if (packageChanged) {
  warning("package.json changed but bun.lock didn't");
  info("You may need to run 'bun install' to update dependencies");
}

const configFiles = [
  'tsconfig.json',
  'bunfig.toml',
  'turbo.json',
  'packages/octavian/tsconfig.json',
  'packages/octavian/tsconfig.build.json',
  'packages/octavian/tsconfig.test.json',
  'packages/octavian/bunfig.toml',
  'packages/octavian/tsdown.config.ts',
];
let configChanged = false;
for (const f of configFiles) {
  if (await fileChangedBetween(f, prevHead, newHead)) {
    configChanged = true;
    info(`Configuration changed: ${f}`);
  }
}
if (configChanged) {
  info('Configuration files changed. You may need to:');
  info('  • Restart your development server');
  info('  • Clear caches if needed');
  info('  • Reload your editor/IDE');
}

const branchText = await $`git rev-parse --abbrev-ref HEAD`.text();
const branch = branchText.trim();
info(`Switched to branch: ${branch}`);

process.exit(0);
