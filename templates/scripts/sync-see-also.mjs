#!/usr/bin/env node
/**
 * sync-see-also.mjs — append missing related: links to page bodies under "## See also"
 * Usage: node {{SCRIPTS_DIR}}/sync-see-also.mjs [--dry] [--wiki-dir <path>]
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const wikiDirFlag = args.indexOf('--wiki-dir');
const WIKI_DIR = resolve(wikiDirFlag >= 0 ? args[wikiDirFlag + 1] : '{{WIKI_DIR}}');

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      fm[key] = raw.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else {
      fm[key] = raw.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

function extractBodyLinks(content) {
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '');
  return new Set(
    [...body.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)]
      .map(([, , path]) => path.split('#')[0])
  );
}

function walkMd(dir, skip = []) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (skip.some(s => full.includes(s))) continue;
    if (statSync(full).isDirectory()) results.push(...walkMd(full, skip));
    else if (entry.endsWith('.md')) results.push(full);
  }
  return results;
}

// Build title lookup: abs path → title
const titleMap = new Map();
for (const file of walkMd(WIKI_DIR, ['raw'])) {
  const content = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(content);
  if (fm?.title) titleMap.set(file, fm.title);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SKIP = ['index.md', 'log.md'];
let changed = 0;

for (const file of walkMd(WIKI_DIR, ['raw'])) {
  if (SKIP.some(s => file.endsWith(s))) continue;

  const content = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) continue;

  const related = Array.isArray(fm.related) ? fm.related : [];
  if (related.length === 0) continue;

  const fileDir = dirname(file);
  const bodyLinks = extractBodyLinks(content);

  const missing = [];
  for (const rel of related) {
    const absTarget = resolve(WIKI_DIR, rel);
    const relFromFile = relative(fileDir, absTarget).replace(/\\/g, '/');
    if (!bodyLinks.has(rel) && !bodyLinks.has(relFromFile) && !bodyLinks.has('./' + relFromFile)) {
      const title = titleMap.get(absTarget) ?? rel;
      missing.push(`- [${title}](${relFromFile})`);
    }
  }

  if (missing.length === 0) continue;

  const relPath = relative(process.cwd(), file);
  if (dry) {
    console.log(`  ${relPath}: would add ${missing.length} link(s)`);
    missing.forEach(l => console.log(`    ${l}`));
    continue;
  }

  // Append to existing "## See also" or create new section
  let updated;
  if (/^## See also/m.test(content)) {
    updated = content.trimEnd() + '\n' + missing.join('\n') + '\n';
  } else {
    updated = content.trimEnd() + '\n\n## See also\n\n' + missing.join('\n') + '\n';
  }

  writeFileSync(file, updated, 'utf8');
  console.log(`  ✓ ${relPath}: added ${missing.length} link(s)`);
  changed++;
}

if (!dry) {
  console.log(`\nDone. ${changed} file(s) updated.`);
}
