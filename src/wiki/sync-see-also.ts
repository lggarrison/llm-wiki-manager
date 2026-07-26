import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { parseFrontmatter } from './frontmatter.js';
import { walkMdSkipDirs } from './walk.js';
import type { WikiContext } from './context.js';

function extractBodyLinks(content: string): Set<string> {
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '');
  return new Set(
    [...body.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)].map(([, , path]) => path.split('#')[0]),
  );
}

/**
 * Insert links at the end of an existing "## See also" section (before the
 * next heading), or append a new section at the end of the file.
 */
function insertSeeAlsoLinks(content: string, links: string[]): string {
  const headingMatch = findSeeAlsoHeading(content);
  if (!headingMatch) {
    return `${content.trimEnd()}\n\n## See also\n\n${links.join('\n')}\n`;
  }

  const sectionStart = headingMatch.index + headingMatch.length;
  const rest = content.slice(sectionStart);
  const nextHeading = findNextHeading(rest);

  if (nextHeading < 0) {
    return `${content.trimEnd()}\n${links.join('\n')}\n`;
  }

  const sectionBody = rest.slice(0, nextHeading);
  const after = rest.slice(nextHeading);
  const before = content.slice(0, sectionStart);
  return `${before}${sectionBody.trimEnd()}\n${links.join('\n')}\n\n${after}`;
}

type HeadingMatch = {
  index: number;
  length: number;
};

function isFenceLine(line: string): boolean {
  return /^\s*(```|~~~)/.test(line.replace(/\r$/, ''));
}

function findSeeAlsoHeading(content: string): HeadingMatch | null {
  let inFence = false;
  let position = 0;

  while (position < content.length) {
    const lineStart = position;
    const newline = content.indexOf('\n', position);
    const lineEnd = newline >= 0 ? newline : content.length;
    const line = content.slice(lineStart, lineEnd);
    position = newline >= 0 ? newline + 1 : content.length;

    const comparableLine = line.replace(/\r$/, '');
    if (isFenceLine(line)) {
      inFence = !inFence;
      continue;
    }

    if (!inFence && /^## See also[^\n]*$/.test(comparableLine)) {
      return { index: lineStart, length: line.length };
    }
  }

  return null;
}

function findNextHeading(content: string): number {
  let inFence = false;
  let position = 0;

  while (position < content.length) {
    const lineStart = position;
    const newline = content.indexOf('\n', position);
    const lineEnd = newline >= 0 ? newline : content.length;
    const line = content.slice(lineStart, lineEnd);
    position = newline >= 0 ? newline + 1 : content.length;

    const comparableLine = line.replace(/\r$/, '');
    if (isFenceLine(line)) {
      inFence = !inFence;
      continue;
    }

    if (!inFence && /^#{1,6} /.test(comparableLine)) {
      return lineStart;
    }
  }

  return -1;
}

export type SyncOptions = {
  dry?: boolean;
};

const SKIP_DIRS = ['raw', 'archive', '.obsidian'];
const SKIP_FILES = new Set(['index.md', 'log.md']);

export function runSync(ctx: WikiContext, options: SyncOptions = {}): number {
  const { wikiDir, cwd } = ctx;
  const dry = options.dry ?? false;

  const pages = walkMdSkipDirs(wikiDir, SKIP_DIRS);

  const titleMap = new Map<string, string>();
  for (const file of pages) {
    const content = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(content);
    if (fm?.title) titleMap.set(file, fm.title as string);
  }

  let changed = 0;

  for (const file of pages) {
    const rel = relative(wikiDir, file).replace(/\\/g, '/');
    if (SKIP_FILES.has(rel)) continue;

    const content = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) continue;

    const related = Array.isArray(fm.related) ? fm.related : [];
    if (related.length === 0) continue;

    const fileDir = dirname(file);
    const bodyLinks = extractBodyLinks(content);

    const missing: string[] = [];
    for (const relTarget of related) {
      const absTarget = resolve(wikiDir, relTarget);
      const relFromFile = relative(fileDir, absTarget).replace(/\\/g, '/');
      if (
        !bodyLinks.has(relTarget) &&
        !bodyLinks.has(relFromFile) &&
        !bodyLinks.has('./' + relFromFile)
      ) {
        const title = titleMap.get(absTarget) ?? relTarget;
        missing.push(`- [${title}](${relFromFile})`);
      }
    }

    if (missing.length === 0) continue;

    const relPath = relative(cwd, file);
    if (dry) {
      console.log(`  ${relPath}: would add ${missing.length} link(s)`);
      missing.forEach((l) => console.log(`    ${l}`));
      continue;
    }

    writeFileSync(file, insertSeeAlsoLinks(content, missing), 'utf8');
    console.log(`  ✓ ${relPath}: added ${missing.length} link(s)`);
    changed++;
  }

  if (!dry) {
    console.log(`\nDone. ${changed} file(s) updated.`);
  }

  return 0;
}
