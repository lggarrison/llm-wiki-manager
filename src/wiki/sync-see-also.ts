import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative, dirname, isAbsolute } from 'path';
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
  const headingMatch = content.match(/^## See also[^\n]*$/m);
  if (!headingMatch || headingMatch.index === undefined) {
    return `${content.trimEnd()}\n\n## See also\n\n${links.join('\n')}\n`;
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = content.slice(sectionStart);
  const nextHeading = rest.search(/^#{1,6} /m);

  if (nextHeading < 0) {
    return `${content.trimEnd()}\n${links.join('\n')}\n`;
  }

  const sectionBody = rest.slice(0, nextHeading);
  const after = rest.slice(nextHeading);
  const before = content.slice(0, sectionStart);
  return `${before}${sectionBody.trimEnd()}\n${links.join('\n')}\n\n${after}`;
}

export type SyncOptions = {
  dry?: boolean;
};

const SKIP_DIRS = ['raw', 'archive', '.obsidian'];
const SKIP_FILES = new Set(['index.md', 'log.md']);

function isInsideWiki(wikiDir: string, absPath: string): boolean {
  const rel = relative(wikiDir, absPath).replace(/\\/g, '/');
  return Boolean(rel && !rel.startsWith('..') && rel !== '..');
}

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
  const errors: string[] = [];
  const updates: { file: string; relPath: string; content: string; missing: string[] }[] = [];

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
      if (isAbsolute(relTarget) || !isInsideWiki(wikiDir, absTarget)) {
        errors.push(
          `  ${relative(cwd, file)}: related path must stay inside the wiki: ${relTarget}`,
        );
        continue;
      }

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
    updates.push({ file, relPath, content, missing });
  }

  if (errors.length > 0) {
    console.error('sync-see-also: unsafe related path(s) found:');
    errors.forEach((e) => console.error(e));
    return 1;
  }

  for (const { file, relPath, content, missing } of updates) {
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
