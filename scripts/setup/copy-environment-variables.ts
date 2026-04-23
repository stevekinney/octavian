#!/usr/bin/env bun
import path from 'node:path';

import chalk from 'chalk';

// Use import.meta.dir for reliable path resolution during bun create
const setupDir = import.meta.dir;
const projectRoot = path.dirname(path.dirname(setupDir)); // scripts/setup -> scripts -> project
const envExamplePath = path.join(projectRoot, '.env.example');
const envPath = path.join(projectRoot, '.env');

function parseKeys(contents: string): Set<string> {
  return new Set(
    contents
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0]!.trim()),
  );
}

try {
  const envExampleFile = Bun.file(envExamplePath);
  if (!(await envExampleFile.exists())) {
    console.log(chalk.yellow('No .env.example found, skipping.'));
    process.exit(0);
  }
  const example = await envExampleFile.text();
  let current = '';
  try {
    current = await Bun.file(envPath).text();
  } catch {
    // no .env yet
  }

  if (!current) {
    await Bun.write(envPath, example);
    console.log(chalk.green('Created .env from .env.example.'));
  } else {
    // Merge: ensure all keys from example exist in .env without overwriting existing values
    const exampleKeys = parseKeys(example);
    const currentKeys = parseKeys(current);
    const missing = [...exampleKeys].filter((k) => !currentKeys.has(k));
    if (missing.length) {
      const lines = example.split('\n').filter((l) => missing.includes(l.split('=')[0]!.trim()));
      const appended = (current.endsWith('\n') ? '' : '\n') + lines.join('\n') + '\n';
      await Bun.write(envPath, current + appended);
      console.log(chalk.green(`Appended ${missing.length} missing key(s) from .env.example.`));
    } else {
      console.log(chalk.gray('No missing keys from .env.example.'));
    }
  }
} catch (err) {
  console.error(chalk.red('Failed to copy from .env.example:'), err);
  process.exit(1);
}
