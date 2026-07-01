#!/usr/bin/env node
/**
 * migrate-pages.mjs — auto-fix wiki pages when schema/lint rules change
 * Usage: node scripts/wiki/migrate-pages.mjs [--wiki-dir <path>] [--dry-run]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wikiDirFlag = args.indexOf('--wiki-dir');
const WIKI_DIR = resolve(wikiDirFlag >= 0 ? args[wikiDirFlag + 1] : 'wiki');

const STATUS_MAP = {
  draft: 'wip',
  stable: 'active',
  archived: 'deprecated',
};

const META_SKIP = new Set(['index.md', 'log.md', 'schema.md', 'README.md', 'AGENTS.md']);
const SKIP_DIRS = ['raw', 'archive'];

function walkMd(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(WIKI_DIR, full).replace(/\\/g, '/');
    if (SKIP_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
    if (statSync(full).isDirectory()) results.push(...walkMd(full));
    else if (entry.endsWith('.md')) results.push(full);
  }
  return results;
}

function migrateStatus(content) {
  let updated = content;
  let changed = false;
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    const re = new RegExp(`^(status:\\s*)${oldStatus}\\s*$`, 'm');
    if (re.test(updated)) {
      updated = updated.replace(re, `$1${newStatus}`);
      changed = true;
    }
  }
  if (!/^status:/m.test(updated) && /^---\r?\n[\s\S]*?\r?\n---/.test(updated)) {
    updated = updated.replace(/^(---\r?\n[\s\S]*?)(\r?\n---)/, (match, body, end) => {
      if (/^status:/m.test(body)) return match;
      changed = true;
      return `${body}\nstatus: wip${end}`;
    });
  }
  return { updated, changed };
}

function migrateWikilinks(content) {
  let changed = false;
  const updated = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    changed = true;
    const slug = target.trim().replace(/\s+/g, '-').toLowerCase();
    const text = (label ?? target).trim();
    if (target.includes('/')) {
      return `[${text}](${target}.md)`;
    }
    return `[${text}](concepts/${slug}.md)`;
  });
  return { updated, changed };
}

const pages = walkMd(WIKI_DIR);
let migrated = 0;

for (const file of pages) {
  const rel = relative(WIKI_DIR, file).replace(/\\/g, '/');
  if (META_SKIP.has(rel.split('/').pop())) continue;

  let content = readFileSync(file, 'utf8');
  let changed = false;

  const statusResult = migrateStatus(content);
  content = statusResult.updated;
  changed ||= statusResult.changed;

  const linkResult = migrateWikilinks(content);
  content = linkResult.updated;
  changed ||= linkResult.changed;

  if (changed) {
    migrated += 1;
    if (!dryRun) writeFileSync(file, content, 'utf8');
    console.log(`  migrated ${rel}`);
  }
}

console.log(
  dryRun
    ? `migrate-pages: ${migrated} page(s) would be updated (dry run)`
    : `migrate-pages: updated ${migrated} page(s)`,
);
