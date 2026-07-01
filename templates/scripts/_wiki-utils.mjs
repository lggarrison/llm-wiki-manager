/**
 * Shared wiki path helpers for management scripts.
 */
import { relative, resolve, dirname, basename } from 'path';

export const RAW_ARTIFACT_DIRS = [
  'articles',
  'prs',
  'tickets',
  'design-notes',
  'transcripts',
  'assets',
];

export const META_SKIP = new Set(['index.md', 'log.md', 'schema.md', 'README.md', 'AGENTS.md']);

export function readFlag(args, name, fallback) {
  const idx = args.indexOf(name);
  if (idx < 0) return fallback;
  const value = args[idx + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`${name} requires a value`);
    process.exit(1);
  }
  return value;
}

export function resolveWikiDir(args, fallback = '{{WIKI_DIR}}') {
  return resolve(readFlag(args, '--wiki-dir', fallback));
}

export function resolveRepoRoot(args, fallback = process.cwd()) {
  return resolve(readFlag(args, '--repo-root', fallback));
}

export function shouldSkipWikiPath(full, wikiDir) {
  const rel = relative(wikiDir, full).replace(/\\/g, '/');
  if (rel.startsWith('archive/') || rel === 'archive') return true;
  if (rel.includes('.obsidian')) return true;
  for (const sub of RAW_ARTIFACT_DIRS) {
    if (rel.startsWith(`raw/${sub}/`) || rel === `raw/${sub}`) return true;
  }
  return false;
}

export function isRootMetaFile(full, wikiDir) {
  return dirname(full) === wikiDir && META_SKIP.has(basename(full));
}
