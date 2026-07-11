import { existsSync, lstatSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { RAW_ARTIFACT_DIRS } from './constants.js';

export function shouldSkipWikiPath(wikiDir: string, full: string): boolean {
  const rel = relative(wikiDir, full).replace(/\\/g, '/');
  if (rel.startsWith('archive/') || rel === 'archive') return true;
  if (rel.includes('.obsidian')) return true;
  for (const sub of RAW_ARTIFACT_DIRS) {
    if (rel.startsWith(`raw/${sub}/`) || rel === `raw/${sub}`) return true;
  }
  return false;
}

export function walkMd(wikiDir: string): string[] {
  return walkMarkdownFiles(wikiDir, (full) => shouldSkipWikiPath(wikiDir, full));
}

export function walkMdSkipDirs(wikiDir: string, skipDirs: string[]): string[] {
  return walkMarkdownFiles(wikiDir, (full) => {
    const rel = relative(wikiDir, full).replace(/\\/g, '/');
    return skipDirs.some((d) => rel === d || rel.startsWith(`${d}/`));
  });
}

function walkMarkdownFiles(wikiDir: string, shouldSkip: (full: string) => boolean): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (shouldSkip(full)) continue;
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.md')) results.push(full);
    }
  }
  walk(wikiDir);
  return results;
}
