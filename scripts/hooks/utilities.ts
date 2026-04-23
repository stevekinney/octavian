import { $ } from 'bun';
import chalk from 'chalk';
import { capitalCase } from 'change-case';

export const isContinuousIntegration = () =>
  process.env['CI'] === 'true' || process.env['CI'] === '1';

export function header(title: string) {
  const text = capitalCase(title);
  console.log('\n' + chalk.bgBlue.black(` ${text} `));
}

export const info = (msg: string) => console.log(chalk.cyan(msg));
export const success = (msg: string) => console.log(chalk.green(msg));
export const warning = (msg: string) => console.log(chalk.yellow(msg));
export const error = (msg: string) => console.error(chalk.red(msg));

export async function getStagedFiles(): Promise<string[]> {
  const out = await $`git diff --cached --name-only`.text();
  return out.split('\n').filter(Boolean);
}

export async function fileChangedBetween(
  file: string,
  prev: string,
  next: string,
): Promise<boolean> {
  const out = await $`git diff --name-only ${prev}..${next} -- ${file}`.text();
  return out.trim().length > 0;
}

export async function printGitStatistics(refA: string, refB: string) {
  const out = await $`git diff --stat ${refA} ${refB}`.text();
  await Bun.write(Bun.stdout, out);
}
