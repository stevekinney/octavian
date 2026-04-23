#!/usr/bin/env bun
import { $ } from 'bun';

import { getStagedFiles, info, warning } from './utilities.ts';

const staged = await getStagedFiles();

if (staged.includes('package.json') && !staged.includes('bun.lock')) {
  const bunLockStatus = await $`git status --porcelain -- bun.lock`.text();
  if (bunLockStatus.trim().length > 0) {
    warning('bun.lock has unstaged changes');
    info('Run bun install and stage bun.lock before committing');
    process.exit(1);
  }
}
