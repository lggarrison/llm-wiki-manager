#!/usr/bin/env node
/**
 * log.mjs — append operation entries to wiki/log.md
 * Usage: node {{SCRIPTS_DIR}}/log.mjs add <op> "<title>" [--date=YYYY-MM-DD|YYYY-MM-DDTHH:MM:SSZ] [--wiki-dir <path>]
 *
 * Operations: ingest | query | lint | maintenance
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { readFlag } from './_wiki-utils.mjs';

const VALID_OPS = new Set(['ingest', 'query', 'lint', 'maintenance']);

const args = process.argv.slice(2);
const [command, op, ...rest] = args;

if (command !== 'add') {
  console.error(
    `Usage: node log.mjs add <op> "<title>" [--date=YYYY-MM-DD|YYYY-MM-DDTHH:MM:SSZ] [--wiki-dir <path>]`,
  );
  console.error(`Operations: ${[...VALID_OPS].join(', ')}`);
  process.exit(1);
}

if (!VALID_OPS.has(op)) {
  console.error(`Unknown operation "${op}". Must be one of: ${[...VALID_OPS].join(', ')}`);
  process.exit(1);
}

const wikiDirFlag = rest.indexOf('--wiki-dir');
const WIKI_DIR = resolve(readFlag(rest, '--wiki-dir', '{{WIKI_DIR}}'));

const dateFlag = rest.find(a => a.startsWith('--date='));
let date;
if (dateFlag) {
  const rawDate = dateFlag.slice(7);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    date = `${rawDate}T00:00:00Z`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(rawDate)) {
    date = rawDate;
  } else {
    console.error(`Invalid date "${rawDate}" — must be YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ`);
    process.exit(1);
  }
} else {
  date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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
