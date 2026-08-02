import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';
import { parseFrontmatter, detectBlockListKeys } from './frontmatter.js';
import { walkMd } from './walk.js';
import {
  VALID_TYPES,
  VALID_STATUSES,
  REQUIRED_FIELDS,
  ENTITY_TYPES,
  HUB_PATHS,
  KEBAB_MD,
  TYPE_PLACEMENT,
  META_SKIP,
  RAW_ARTIFACT_DIRS,
} from './constants.js';
import type { WikiContext } from './context.js';

export type LintOptions = {
  warnOnly?: boolean;
};

const ARRAY_FRONTMATTER_FIELDS = ['related', 'code_refs', 'sources', 'tags'] as const;

function findRawArtifact(wikiDir: string, slug: string): string | null {
  for (const sub of RAW_ARTIFACT_DIRS) {
    const rel = `raw/${sub}/${slug}.md`;
    if (existsSync(join(wikiDir, rel))) return rel;
  }
  return null;
}

function isInsideWiki(wikiDir: string, absPath: string): boolean {
  const rel = relative(wikiDir, absPath).replace(/\\/g, '/');
  return Boolean(rel && !rel.startsWith('..') && rel !== '..');
}

function extractBodyLinks(content: string): string[] {
  const links: string[] = [];
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '');
  for (const match of body.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    const path = match[2];
    if (!path.startsWith('http')) links.push(path.split('#')[0]);
  }
  return links;
}

function extractWikilinks(content: string): string[] {
  return [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
}

function allowsDirectoryLink(
  wikiDir: string,
  pageRel: string,
  _link: string,
  target: string,
): boolean {
  if (pageRel !== 'raw/raw.md') return false;
  const targetRel = relative(wikiDir, target).replace(/\\/g, '/');
  return targetRel.startsWith('raw/');
}

function describePlacement(type: string): string {
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

export function runLint(ctx: WikiContext, options: LintOptions = {}): number {
  const { wikiDir, repoRoot, cwd } = ctx;
  const warnOnly = options.warnOnly ?? false;

  const errors: string[] = [];
  const warnings: string[] = [];

  function err(file: string, msg: string): void {
    errors.push(`  ${relative(cwd, file)}: ${msg}`);
  }
  function warn(file: string, msg: string): void {
    warnings.push(`  ${relative(cwd, file)}: ${msg}`);
  }

  const pages = walkMd(wikiDir);

  const entitiesDir = join(wikiDir, 'entities');
  if (existsSync(entitiesDir)) {
    for (const entry of readdirSync(entitiesDir)) {
      const full = join(entitiesDir, entry);
      if (statSync(full).isDirectory()) {
        err(full, `entities/ must be flat — remove subdirectory: ${entry}/`);
      }
    }
  }

  const scopesPath = join(wikiDir, '.entity-scopes');
  if (existsSync(scopesPath) && existsSync(entitiesDir)) {
    const required = readFileSync(scopesPath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
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

  const inbound = new Map(pages.map((p) => [p, 0]));

  for (const file of pages) {
    const content = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(content);
    const fileDir = dirname(file);
    const relPath = relative(wikiDir, file).replace(/\\/g, '/');
    const fileName = basename(file);

    if (META_SKIP.has(fileName) && dirname(file) === wikiDir) continue;

    if (!fm) {
      err(file, 'missing frontmatter');
      continue;
    }

    for (const key of detectBlockListKeys(content)) {
      err(
        file,
        `frontmatter field "${key}" uses a block-style YAML list — use an inline array instead: ${key}: [a, b]`,
      );
    }

    for (const key of ARRAY_FRONTMATTER_FIELDS) {
      if (fm[key] !== undefined && !Array.isArray(fm[key])) {
        err(file, `frontmatter field "${key}" must be an inline array: ${key}: [a, b]`);
      }
    }

    for (const field of REQUIRED_FIELDS) {
      if (fm[field] === undefined || fm[field] === '') {
        err(file, `missing required frontmatter field: ${field}`);
      }
    }

    if (fm.type && !VALID_TYPES.has(fm.type as string)) {
      err(file, `invalid type "${fm.type}" — must be one of: ${[...VALID_TYPES].join(', ')}`);
    }

    if (
      fm.type &&
      TYPE_PLACEMENT[fm.type as string] &&
      !TYPE_PLACEMENT[fm.type as string].test(relPath)
    ) {
      err(file, `type "${fm.type}" must be placed at ${describePlacement(fm.type as string)}`);
    }

    if (fm.type === 'hub' && !HUB_PATHS.has(relPath)) {
      err(file, 'hub pages are only allowed at README.md, index.md, or raw/raw.md');
    }

    if (!KEBAB_MD.test(fileName)) {
      err(file, `filename must be lowercase kebab-case: ${fileName}`);
    }

    if (ENTITY_TYPES.has(fm.type as string) && dirname(file) === entitiesDir) {
      const slug = basename(file, '.md');
      const tags = Array.isArray(fm.tags) ? fm.tags : [];
      if (tags.length === 0 || tags[0] !== slug) {
        warn(file, `scope-tag: first tag should be "${slug}", got "${tags[0] ?? ''}"`);
      }
    }

    if (fm.status && !VALID_STATUSES.has(fm.status as string)) {
      err(
        file,
        `invalid status "${fm.status}" — must be one of: ${[...VALID_STATUSES].join(', ')}`,
      );
    }

    if (
      fm.last_updated &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(fm.last_updated as string)
    ) {
      err(
        file,
        `last_updated must be a UTC ISO timestamp (YYYY-MM-DDTHH:MM:SSZ), got: ${fm.last_updated}`,
      );
    }

    const codeRefs = Array.isArray(fm.code_refs) ? fm.code_refs : [];
    for (const ref of codeRefs) {
      const target = resolve(repoRoot, ref);
      if (!existsSync(target)) {
        err(file, `code_refs: path does not exist: ${ref}`);
      }
    }

    if (fm.type === 'source') {
      const slug = basename(file, '.md');
      const rawPath = findRawArtifact(wikiDir, slug);
      if (!rawPath) {
        err(file, `source page must pair with a raw artifact: raw/<category>/${slug}.md`);
      }
    }

    const related = Array.isArray(fm.related) ? fm.related : [];
    for (const rel of related) {
      const target = resolve(wikiDir, rel);
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
        if (existsSync(target) && allowsDirectoryLink(wikiDir, relPath, link, target)) continue;
        err(file, `body link must target a wiki page (.md), not a code or directory path: ${link}`);
        continue;
      }

      if (!existsSync(target)) {
        err(file, `broken body link: ${link}`);
        continue;
      }

      if (!isInsideWiki(wikiDir, target)) {
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
        const targetRel = relative(wikiDir, target).replace(/\\/g, '/');
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

    const bodyLinkTargets = new Set(bodyLinks.map((l) => resolve(fileDir, l)));
    for (const rel of related) {
      const target = resolve(wikiDir, rel);
      if (!bodyLinkTargets.has(target)) {
        warn(file, `related: "${rel}" has no corresponding body link — run npm run wiki:sync`);
      }
    }
  }

  for (const [file, count] of inbound) {
    if (count === 0) {
      const content = readFileSync(file, 'utf8');
      const fm = parseFrontmatter(content);
      if (fm && !['hub', 'overview'].includes(fm.type as string)) {
        warn(file, 'orphaned page — no other page links to it');
      }
    }
  }

  const agentsPath = resolve(repoRoot, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const agentsContent = readFileSync(agentsPath, 'utf8');
    for (const match of agentsContent.matchAll(/\[([^\]]*)\]\(([^)]+\.md)\)/g)) {
      const link = match[2];
      const target = resolve(repoRoot, link);
      if (!existsSync(target)) {
        warn(agentsPath, `stale wiki reference: ${link}`);
      }
    }
  }

  const pageCount = pages.length;
  console.log(`\nWiki lint — ${pageCount} page(s) checked\n`);

  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠  ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`  ✗  ${e}`));
    console.log('');
    if (!warnOnly) return 1;
  } else {
    console.log('✓ No errors found.');
  }

  return 0;
}
