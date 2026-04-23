#!/usr/bin/env bun
import { $ } from 'bun';

import {
  error,
  header,
  info,
  isContinuousIntegration,
  printGitStatistics,
  success,
  warning,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

header('Post-merge hook');

const changedList = await $`git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD`.text();
const changed = changedList.split('\n').filter(Boolean);

const has = (f: string) => changed.includes(f);
const any = (files: string[]) => files.some((f) => has(f));

const configFiles = [
  'tsconfig.json',
  '.oxlintrc.json',
  '.prettierrc',
  'bunfig.toml',
  '.env.example',
];

const needsInstall = any(['package.json', 'bun.lock']);
const needsClean = any(configFiles);

const important: string[] = [];
if (needsInstall) important.push('Dependencies updated');
for (const f of configFiles) if (has(f)) important.push(`${f} configuration updated`);

if (needsInstall) {
  info('Installing dependencies…');
  try {
    await $`bun install`;
    success('Dependencies installed');
  } catch {
    warning('Failed to install dependencies — run bun install');
  }
}

if (needsClean) {
  info('Cleaning caches…');
  try {
    await $`bun run clean`;
    success('Caches cleaned');
  } catch {
    warning('Clean task failed');
  }
}

if (important.length) {
  header('Summary of important changes');
  for (const msg of important) info(`• ${msg}`);
  console.log('');
}

info('Merge statistics:');
await printGitStatistics('ORIG_HEAD', 'HEAD');

try {
  await $`git grep -n "^<<<<<<< |^======= |^>>>>>>> "`;
  // If grep finds matches, it exits 0 and prints them, which is bad — treat as error
  error('Found conflict markers in files!');
  info('Please resolve any remaining conflicts');
} catch {
  // No conflict markers found; grep exits with non-zero status
}

const branchText = await $`git rev-parse --abbrev-ref HEAD`.text();
const branch = branchText.trim();
info(`Merged into branch: ${branch}`);
if (important.length) {
  info('You may need to:');
  info('  • Restart your development server');
  info('  • Reload your editor/IDE');
}

process.exit(0);
