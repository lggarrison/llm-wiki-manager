#!/usr/bin/env node
/**
 * lint.mjs — validate wiki frontmatter, links, and structure
 * Usage: node {{SCRIPTS_DIR}}/lint.mjs [--warn-only] [--wiki-dir <path>] [--repo-root <path>]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';
import {
  RAW_ARTIFACT_DIRS,
  resolveWikiDir,
  resolveRepoRoot,
  shouldSkipWikiPath,
  isRootMetaFile,
} from './_wiki-utils.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const warnOnly = args.includes('--warn-only');
const WIKI_DIR = resolveWikiDir(args);
const REPO_ROOT = resolveRepoRoot(args);

const VALID_TYPES = new Set([
  'overview',
  'entity',
  'comparison',
  'deep-dive',
  'concept',
  'source',
  'hub',
]);
const VALID_STATUSES = new Set(['active', 'deprecated', 'wip']);
const REQUIRED_FIELDS = ['type', 'title', 'last_updated'];
const ENTITY_TYPES = new Set(['overview', 'entity', 'comparison', 'deep-dive']);
const HUB_PATHS = new Set(['README.md', 'index.md', 'raw/raw.md']);
const KEBAB_MD = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;

const TYPE_PLACEMENT = {
  overview: /^entities\/[^/]+\.md$/,
  entity: /^entities\/[^/]+\.md$/,
  comparison: /^entities\/[^/]+\.md$/,
  'deep-dive': /^entities\/[^/]+\.md$/,
  concept: /^concepts\/[^/]+\.md$/,
  source: /^sources\/[^/]+\.md$/,
  hub: /^(README\.md|index\.md|raw\/raw\.md)$/,
};

function isInsideWiki(absPath) {
  const rel = relative(WIKI_DIR, absPath).replace(/\\/g, '/');
  return rel && !rel.startsWith('..') && rel !== '..';
}

function findRawArtifact(slug) {
  for (const sub of RAW_ARTIFACT_DIRS) {
    const rel = `raw/${sub}/${slug}.md`;
    if (existsSync(join(WIKI_DIR, rel))) return rel;
  }
  return null;
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
    if (shouldSkipWikiPath(full, WIKI_DIR)) continue;
    if (statSync(full).isDirectory()) results.push(...walkMd(full));
    else if (entry.endsWith('.md')) results.push(full);
  }
  return results;
}

// ── Link extractor ────────────────────────────────────────────────────────────

function extractBodyLinks(content) {
  const links = [];
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

function allowsDirectoryLink(pageRel, link, target) {
  if (pageRel !== 'raw/raw.md') return false;
  const targetRel = relative(WIKI_DIR, target).replace(/\\/g, '/');
  return targetRel.startsWith('raw/');
}

function describePlacement(type) {
  switch (type) {
    case 'overview':
    case 'entity':
    case 'comparison':
    case 'deep-dive':
      return 'entities/<slug>.md';
    case 'concept':
      return 'concepts/<slug>.md';
    case 'source':
      return 'sources/<slug>.md';
    case 'hub':
      return 'README.md, index.md, or raw/raw.md';
    default:
      return '(unknown)';
  }
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
    } else {
      const content = readFileSync(target, 'utf8');
      const fm = parseFrontmatter(content);
      if (fm?.type !== 'overview') {
        err(target, `entities/${slug}.md must have type: overview (scope entry point)`);
      }
    }
  }
}

const inbound = new Map(pages.map(p => [p, 0]));

for (const file of pages) {
  const content = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(content);
  const fileDir = dirname(file);
  const relPath = relative(WIKI_DIR, file).replace(/\\/g, '/');
  const fileName = basename(file);

  if (isRootMetaFile(file, WIKI_DIR)) continue;

  if (!fm) {
    err(file, 'missing frontmatter');
    continue;
  }

  for (const field of REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === '') {
      err(file, `missing required frontmatter field: ${field}`);
    }
  }

  if (fm.type && !VALID_TYPES.has(fm.type)) {
    err(file, `invalid type "${fm.type}" — must be one of: ${[...VALID_TYPES].join(', ')}`);
  }

  if (fm.type && TYPE_PLACEMENT[fm.type] && !TYPE_PLACEMENT[fm.type].test(relPath)) {
    err(file, `type "${fm.type}" must be placed at ${describePlacement(fm.type)}`);
  }

  if (fm.type === 'hub' && !HUB_PATHS.has(relPath)) {
    err(file, 'hub pages are only allowed at README.md, index.md, or raw/raw.md');
  }

  if (!KEBAB_MD.test(fileName)) {
    err(file, `filename must be lowercase kebab-case: ${fileName}`);
  }

  if (ENTITY_TYPES.has(fm.type) && dirname(file) === entitiesDir) {
    const slug = basename(file, '.md');
    const tags = Array.isArray(fm.tags) ? fm.tags : [];
    if (tags.length === 0 || tags[0] !== slug) {
      warn(file, `scope-tag: first tag should be "${slug}", got "${tags[0] ?? ''}"`);
    }
  }

  if (fm.status && !VALID_STATUSES.has(fm.status)) {
    err(file, `invalid status "${fm.status}" — must be one of: ${[...VALID_STATUSES].join(', ')}`);
  }

  if (fm.last_updated && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(fm.last_updated)) {
    err(
      file,
      `last_updated must be a UTC ISO timestamp (YYYY-MM-DDTHH:MM:SSZ), got: ${fm.last_updated}`,
    );
  }

  const codeRefs = Array.isArray(fm.code_refs) ? fm.code_refs : [];
  for (const ref of codeRefs) {
    const target = resolve(REPO_ROOT, ref);
    if (!existsSync(target)) {
      err(file, `code_refs: path does not exist: ${ref}`);
    }
  }

  if (fm.type === 'source') {
    const slug = basename(file, '.md');
    const rawPath = findRawArtifact(slug);
    if (!rawPath) {
      err(file, `source page must pair with a raw artifact: raw/<category>/${slug}.md`);
    }
  }

  const related = Array.isArray(fm.related) ? fm.related : [];
  for (const rel of related) {
    const target = resolve(WIKI_DIR, rel);
    if (!existsSync(target)) {
      err(file, `related: path does not exist: ${rel}`);
    } else if (inbound.has(target)) {
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  const bodyLinks = extractBodyLinks(content);
  for (const link of bodyLinks) {
    const target = resolve(fileDir, link);

    if (!link.endsWith('.md')) {
      if (existsSync(target) && allowsDirectoryLink(relPath, link, target)) continue;
      err(file, `body link must target a wiki page (.md), not a code or directory path: ${link}`);
      continue;
    }

    if (!existsSync(target)) {
      err(file, `broken body link: ${link}`);
      continue;
    }

    if (!isInsideWiki(target)) {
      err(file, `phantom-node link (outside vault): ${link}`);
      continue;
    }

    if (statSync(target).isDirectory()) {
      err(file, `phantom-node link (directory): ${link}`);
      continue;
    }

    if (inbound.has(target)) {
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }

    if (fm.type === 'source') {
      const slug = basename(file, '.md');
      const targetRel = relative(WIKI_DIR, target).replace(/\\/g, '/');
      if (targetRel.startsWith('raw/') && basename(target, '.md') === slug) {
        err(
          file,
          `self-loop link to raw artifact — list raw path in frontmatter, not body: ${link}`,
        );
      }
    }
  }

  const wikilinks = extractWikilinks(content);
  for (const wl of wikilinks) {
    err(file, `wikilink [[${wl}]] found — use markdown links instead`);
  }

  const bodyLinkTargets = new Set(bodyLinks.map(l => resolve(fileDir, l)));
  for (const rel of related) {
    const target = resolve(WIKI_DIR, rel);
    if (!bodyLinkTargets.has(target)) {
      warn(file, `related: "${rel}" has no corresponding body link — run sync-see-also.mjs`);
    }
  }
}

for (const [file, count] of inbound) {
  if (count === 0) {
    const content = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(content);
    if (fm && !['hub', 'overview'].includes(fm.type)) {
      warn(file, 'orphaned page — no other page links to it');
    }
  }
}

const agentsPath = resolve(REPO_ROOT, 'AGENTS.md');
if (existsSync(agentsPath)) {
  const agentsContent = readFileSync(agentsPath, 'utf8');
  for (const match of agentsContent.matchAll(/\[([^\]]*)\]\(([^)]+\.md)\)/g)) {
    const link = match[2];
    const target = resolve(REPO_ROOT, link);
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
