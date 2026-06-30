#!/usr/bin/env node
/**
 * lint.mjs — validate wiki frontmatter, links, and structure
 * Usage: node {{SCRIPTS_DIR}}/lint.mjs [--warn-only] [--wiki-dir <path>]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const warnOnly = args.includes('--warn-only');
const wikiDirFlag = args.indexOf('--wiki-dir');
const WIKI_DIR = resolve(wikiDirFlag >= 0 ? args[wikiDirFlag + 1] : '{{WIKI_DIR}}');

const VALID_TYPES = new Set(['concept', 'source', 'overview', 'hub']);
const VALID_STATUSES = new Set(['draft', 'stable', 'archived']);
const REQUIRED_FIELDS = ['type', 'title', 'last_updated', 'tags', 'related', 'status'];

const RAW_ARTIFACT_DIRS = ['articles', 'prs', 'tickets', 'design-notes', 'transcripts', 'assets'];

function shouldSkipWikiPath(full) {
  const rel = relative(WIKI_DIR, full).replace(/\\/g, '/');
  if (rel.startsWith('archive/') || rel === 'archive') return true;
  if (rel.includes('.obsidian')) return true;
  for (const sub of RAW_ARTIFACT_DIRS) {
    if (rel.startsWith(`raw/${sub}/`) || rel === `raw/${sub}`) return true;
  }
  return false;
}

// ── Frontmatter parser ────────────────────────────────────────────────────────

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

// ── File walker ───────────────────────────────────────────────────────────────

function walkMd(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (shouldSkipWikiPath(full)) continue;
    if (statSync(full).isDirectory()) results.push(...walkMd(full));
    else if (entry.endsWith('.md')) results.push(full);
  }
  return results;
}

// ── Link extractor ────────────────────────────────────────────────────────────

function extractBodyLinks(content) {
  const links = [];
  // skip frontmatter block
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '');
  for (const match of body.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    const path = match[2];
    if (!path.startsWith('http')) links.push(path.split('#')[0]);
  }
  return links;
}

function extractWikilinks(content) {
  return [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

function err(file, msg) { errors.push(`  ${relative(process.cwd(), file)}: ${msg}`); }
function warn(file, msg) { warnings.push(`  ${relative(process.cwd(), file)}: ${msg}`); }

const pages = walkMd(WIKI_DIR);

const entitiesDir = join(WIKI_DIR, 'entities');
if (existsSync(entitiesDir)) {
  for (const entry of readdirSync(entitiesDir)) {
    const full = join(entitiesDir, entry);
    if (statSync(full).isDirectory()) {
      err(full, `entities/ must be flat — remove subdirectory: ${entry}/`);
    }
  }
}

const scopesPath = join(WIKI_DIR, '.entity-scopes');
if (existsSync(scopesPath) && existsSync(entitiesDir)) {
  const required = readFileSync(scopesPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  for (const slug of required) {
    const target = join(entitiesDir, `${slug}.md`);
    if (!existsSync(target)) {
      err(scopesPath, `missing entity overview: entities/${slug}.md`);
    }
  }
}

// Build inbound-link map for orphan detection
const inbound = new Map(pages.map(p => [p, 0]));

for (const file of pages) {
  const content = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(content);
  const fileDir = dirname(file);

  // Skip non-wiki meta files
  if (
    file === join(WIKI_DIR, 'index.md') ||
    file === join(WIKI_DIR, 'log.md') ||
    file === join(WIKI_DIR, 'schema.md') ||
    file === join(WIKI_DIR, 'README.md') ||
    file === join(WIKI_DIR, 'AGENTS.md')
  )
    continue;

  const relPath = relative(WIKI_DIR, file).replace(/\\/g, '/');

  // Frontmatter presence
  if (!fm) {
    err(file, 'missing frontmatter');
    continue;
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === '') {
      err(file, `missing required frontmatter field: ${field}`);
    }
  }

  // Valid type
  if (fm.type && !VALID_TYPES.has(fm.type)) {
    err(file, `invalid type "${fm.type}" — must be one of: ${[...VALID_TYPES].join(', ')}`);
  }

  if (fm.type === 'overview' && !relPath.startsWith('entities/')) {
    err(file, 'overview pages must live in entities/<slug>.md');
  }

  if (fm.type === 'overview' && dirname(file) === entitiesDir) {
    const slug = basename(file, '.md');
    const tags = Array.isArray(fm.tags) ? fm.tags : [];
    if (tags.length === 0 || tags[0] !== slug) {
      warn(file, `scope-tag: first tag should be "${slug}", got "${tags[0] ?? ''}"`);
    }
  }

  // Valid status
  if (fm.status && !VALID_STATUSES.has(fm.status)) {
    err(file, `invalid status "${fm.status}" — must be one of: ${[...VALID_STATUSES].join(', ')}`);
  }

  // last_updated format
  if (fm.last_updated && !/^\d{4}-\d{2}-\d{2}$/.test(fm.last_updated)) {
    err(file, `last_updated must be YYYY-MM-DD, got: ${fm.last_updated}`);
  }

  // related: paths resolve
  const related = Array.isArray(fm.related) ? fm.related : [];
  for (const rel of related) {
    const target = resolve(WIKI_DIR, rel);
    if (!existsSync(target)) {
      err(file, `related: path does not exist: ${rel}`);
    } else if (inbound.has(target)) {
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  // Body links resolve
  const bodyLinks = extractBodyLinks(content);
  for (const link of bodyLinks) {
    const target = resolve(fileDir, link);
    if (!existsSync(target)) {
      err(file, `broken body link: ${link}`);
    } else if (inbound.has(target)) {
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  // Wikilinks are forbidden
  const wikilinks = extractWikilinks(content);
  for (const wl of wikilinks) {
    err(file, `wikilink [[${wl}]] found — use markdown links instead`);
  }

  // related: entries should have a corresponding body link
  const bodyLinkTargets = new Set(
    bodyLinks.map(l => resolve(fileDir, l))
  );
  for (const rel of related) {
    const target = resolve(WIKI_DIR, rel);
    if (!bodyLinkTargets.has(target)) {
      warn(file, `related: "${rel}" has no corresponding body link — run sync-see-also.mjs`);
    }
  }
}

// Orphan detection (skip hubs and overviews — they ARE the entry points)
for (const [file, count] of inbound) {
  if (count === 0) {
    const content = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(content);
    if (fm && !['hub', 'overview'].includes(fm.type)) {
      warn(file, 'orphaned page — no other page links to it');
    }
  }
}

// Scan AGENTS.md for stale wiki references
const agentsPath = resolve(process.cwd(), 'AGENTS.md');
if (existsSync(agentsPath)) {
  const agentsContent = readFileSync(agentsPath, 'utf8');
  for (const match of agentsContent.matchAll(/\[([^\]]*)\]\(([^)]+\.md)\)/g)) {
    const link = match[2];
    const target = resolve(process.cwd(), link);
    if (!existsSync(target)) {
      warn(agentsPath, `stale wiki reference: ${link}`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const pageCount = pages.length;
console.log(`\nWiki lint — ${pageCount} page(s) checked\n`);

if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach(w => console.log(`  ⚠  ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log(`Errors (${errors.length}):`);
  errors.forEach(e => console.log(`  ✗  ${e}`));
  console.log('');
  if (!warnOnly) process.exit(1);
} else {
  console.log('✓ No errors found.');
}
