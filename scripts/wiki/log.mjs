#!/usr/bin/env node
/**
 * log.mjs — append operation entries to wiki/log.md
 * Usage: node scripts/wiki/log.mjs add <op> "<title>" [--date=YYYY-MM-DD] [--wiki-dir <path>]
 *
 * Operations: ingest | query | lint | maintenance
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const VALID_OPS = new Set(['ingest', 'query', 'lint', 'maintenance']);

const args = process.argv.slice(2);
const [command, op, ...rest] = args;

if (command !== 'add') {
  console.error(`Usage: node log.mjs add <op> "<title>" [--date=YYYY-MM-DD] [--wiki-dir <path>]`);
  console.error(`Operations: ${[...VALID_OPS].join(', ')}`);
  process.exit(1);
}

if (!VALID_OPS.has(op)) {
  console.error(`Unknown operation "${op}". Must be one of: ${[...VALID_OPS].join(', ')}`);
  process.exit(1);
}

const wikiDirFlag = rest.indexOf('--wiki-dir');
const WIKI_DIR = resolve(wikiDirFlag >= 0 ? rest[wikiDirFlag + 1] : 'wiki');

const dateFlag = rest.find(a => a.startsWith('--date='));
const date = dateFlag ? dateFlag.slice(7) : new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Invalid date "${date}" — must be YYYY-MM-DD`);
  process.exit(1);
}

// Title is remaining args that aren't flags
const title = rest
  .filter((a, i) => !a.startsWith('--') && (wikiDirFlag < 0 || i !== wikiDirFlag + 1))
  .join(' ')
  .replace(/^["']|["']$/g, '')
  .trim();

if (!title) {
  console.error('Title is required.');
  process.exit(1);
}

const logPath = join(WIKI_DIR, 'log.md');
if (!existsSync(logPath)) {
  console.error(`log.md not found at ${logPath}`);
  process.exit(1);
}

const entry = `\n## [${date}] ${op} | ${title}\n`;
const existing = readFileSync(logPath, 'utf8');
writeFileSync(logPath, existing.trimEnd() + '\n' + entry, 'utf8');
console.log(`✓ Logged: [${date}] ${op} | ${title}`);
