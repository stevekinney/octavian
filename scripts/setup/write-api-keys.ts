#!/usr/bin/env bun
import path from 'node:path';

import chalk from 'chalk';

const setupDir = import.meta.dir;
const projectRoot = path.dirname(path.dirname(setupDir));
const envPath = path.join(projectRoot, '.env');

type KeySpec = {
  key: string;
  envVar: string;
};

const KEYS: KeySpec[] = [
  { key: 'OPEN_AI_API_KEY', envVar: 'OPEN_AI_API_KEY' },
  { key: 'ANTHROPIC_AI_API_KEY', envVar: 'ANTHROPIC_AI_API_KEY' },
  { key: 'GEMINI_AI_API_KEY', envVar: 'GEMINI_AI_API_KEY' },
];

const PLACEHOLDER_VALUES = new Set(['', 'changeme', 'your-key-here', 'replace-me']);

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function parseEnvironment(contents: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...rest] = trimmed.split('=');
    if (!k) continue;
    map.set(k.trim(), rest.join('='));
  }
  return map;
}

function serializeEnvironment(map: Map<string, string>, original: string): string {
  const lines = original.split('\n');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      out.push(raw);
      continue;
    }
    const [k] = line.split('=');
    const trimmedKey = k?.trim();
    if (trimmedKey && map.has(trimmedKey)) {
      out.push(`${trimmedKey}=${map.get(trimmedKey) ?? ''}`);
      seen.add(trimmedKey);
    } else {
      out.push(raw);
    }
  }
  for (const [k, v] of map.entries()) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }
  return out.join('\n').replace(/\n*$/, '\n');
}

try {
  let envRaw = '';
  try {
    envRaw = await Bun.file(envPath).text();
  } catch {
    envRaw = '';
  }
  const map = parseEnvironment(envRaw);
  let wrote = 0;

  for (const { key, envVar } of KEYS) {
    const shellVal = process.env[envVar];
    if (!shellVal?.length) continue;
    const existing = map.get(key);
    // Only overwrite if the current value is absent or a placeholder.
    if (existing !== undefined && !isPlaceholder(existing)) continue;
    map.set(key, shellVal);
    wrote++;
  }

  if (wrote > 0) {
    const next = serializeEnvironment(map, envRaw);
    await Bun.write(envPath, next);
    console.log(chalk.green(`Wrote ${wrote} API key(s) to .env.`));
  } else {
    console.log(chalk.gray('No API keys written (values already set or shell env empty).'));
  }
} catch (err) {
  console.error(chalk.red('Failed to write API keys to .env:'), err);
  process.exit(1);
}
