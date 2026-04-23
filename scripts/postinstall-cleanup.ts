#!/usr/bin/env bun
import { rm } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

const scriptsDir = import.meta.dir;
const projectRoot = path.dirname(scriptsDir);
const setupDir = path.join(scriptsDir, 'setup');
const pkgPath = path.join(projectRoot, 'package.json');

// Target A: remove "bun-create" entry from package.json.
let targetADone = false;
try {
  const raw = await Bun.file(pkgPath).text();
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.error(chalk.red('package.json is not a JSON object.'));
    process.exit(1);
  }
  const hasBunCreate = Object.prototype.hasOwnProperty.call(parsed, 'bun-create');
  if (!hasBunCreate) {
    targetADone = true;
  } else {
    const snapshot = raw;
    try {
      // parsed is a non-null, non-array object at this point — safe to work with as a dict.
      const entries = Object.entries(parsed).filter(([k]) => k !== 'bun-create');
      const cleaned = Object.fromEntries(entries);
      await Bun.write(pkgPath, JSON.stringify(cleaned, null, 2) + '\n');
      console.log(chalk.green('Removed "bun-create" entry from package.json.'));
      targetADone = true;
    } catch (writeErr) {
      await Bun.write(pkgPath, snapshot).catch(() => undefined);
      console.error(chalk.red('Failed to rewrite package.json:'), writeErr);
    }
  }
} catch (err) {
  console.error(chalk.red('Failed to read package.json:'), err);
}

// Target B: remove scripts/setup directory.
let targetBDone = false;
try {
  const setupFile = Bun.file(path.join(setupDir, '.'));
  const setupExists = await setupFile.exists().catch(() => false);
  if (!setupExists) {
    targetBDone = true;
  } else {
    await rm(setupDir, { recursive: true, force: true });
    console.log(chalk.green('Removed scripts/setup directory.'));
    targetBDone = true;
  }
} catch (err) {
  console.error(chalk.red('Failed to remove scripts/setup:'), err);
}

if (!targetADone || !targetBDone) {
  console.error(chalk.yellow('Cleanup incomplete — re-run to finish remaining steps.'));
  process.exit(1);
}
