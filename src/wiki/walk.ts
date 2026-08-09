import { readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { RAW_ARTIFACT_DIRS } from './constants.js';

export function shouldSkipWikiPath(wikiDir: string, full: string): boolean {
  const rel = relative(wikiDir, full).replace(/\\/g, '/');
  if (rel.startsWith('archive/') || rel === 'archive') return true;
  if (rel === '.obsidian' || rel.startsWith('.obsidian/')) return true;
  for (const sub of RAW_ARTIFACT_DIRS) {
    if (rel.startsWith(`raw/${sub}/`) || rel === `raw/${sub}`) return true;
  }
  return false;
}

export function walkMd(wikiDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (shouldSkipWikiPath(wikiDir, full)) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.md')) results.push(full);
    }
  }
  walk(wikiDir);
  return results;
}

export function walkMdSkipDirs(wikiDir: string, skipDirs: string[]): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = relative(wikiDir, full).replace(/\\/g, '/');
      if (skipDirs.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.md')) results.push(full);
    }
  }
  walk(wikiDir);
  return results;
}
