import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { WikiContext } from './context.js';

const VALID_OPS = new Set(['ingest', 'query', 'lint', 'maintenance']);

export function runLog(ctx: WikiContext, args: string[]): number {
  const [command, op, ...rest] = args;

  if (command !== 'add') {
    console.error(
      `Usage: llm-wiki-manager log add <op> "<title>" [--date=YYYY-MM-DD|YYYY-MM-DDTHH:MM:SSZ] [--wiki-dir <path>]`,
    );
    console.error(`Operations: ${[...VALID_OPS].join(', ')}`);
    return 1;
  }

  if (!VALID_OPS.has(op)) {
    console.error(`Unknown operation "${op}". Must be one of: ${[...VALID_OPS].join(', ')}`);
    return 1;
  }

  const wikiDirFlag = rest.indexOf('--wiki-dir');
  const dateFlag = rest.find((a) => a.startsWith('--date='));

  let date: string;
  if (dateFlag) {
    const rawDate = dateFlag.slice(7);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      date = `${rawDate}T00:00:00Z`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(rawDate)) {
      date = rawDate;
    } else {
      console.error(`Invalid date "${rawDate}" — must be YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ`);
      return 1;
    }
  } else {
    date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  const title = rest
    .filter((a, i) => !a.startsWith('--') && (wikiDirFlag < 0 || i !== wikiDirFlag + 1))
    .join(' ')
    .replace(/^["']|["']$/g, '')
    .trim();

  if (!title) {
    console.error('Title is required.');
    return 1;
  }
  if (/[\r\n]/.test(title)) {
    console.error('Title must be a single line.');
    return 1;
  }

  const logPath = join(ctx.wikiDir, 'log.md');
  if (!existsSync(logPath)) {
    console.error(`log.md not found at ${logPath}`);
    return 1;
  }

  const entry = `\n## [${date}] ${op} | ${title}\n`;
  const existing = readFileSync(logPath, 'utf8');
  writeFileSync(logPath, existing.trimEnd() + '\n' + entry, 'utf8');
  console.log(`✓ Logged: [${date}] ${op} | ${title}`);
  return 0;
}
