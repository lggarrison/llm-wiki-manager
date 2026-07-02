import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, relative, resolve } from 'path';
import { walkMdSkipDirs } from './walk.js';
import { META_SKIP } from './constants.js';
import type { WikiContext } from './context.js';

const STATUS_MAP: Record<string, string> = {
  draft: 'wip',
  stable: 'active',
  archived: 'deprecated',
};

const SKIP_DIRS = ['raw', 'archive'];

function slugify(input: string): string {
  return input.trim().replace(/\s+/g, '-').toLowerCase();
}

function stripMarkdownExtension(input: string): string {
  return input.replace(/\.md$/i, '');
}

function markdownLinkFromWikiRoot(wikiDir: string, file: string, wikiRootTarget: string): string {
  return relative(dirname(file), resolve(wikiDir, wikiRootTarget)).replace(/\\/g, '/');
}

function buildSlugTargetMap(pages: string[], wikiDir: string): Map<string, string[]> {
  const targets = new Map<string, string[]>();
  for (const file of pages) {
    const rel = relative(wikiDir, file).replace(/\\/g, '/');
    const slug = basename(rel, '.md');
    const existing = targets.get(slug) ?? [];
    existing.push(rel);
    targets.set(slug, existing);
  }
  return targets;
}

function migrateStatus(content: string): { updated: string; changed: boolean } {
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

function migrateTimestamps(content: string): { updated: string; changed: boolean } {
  let changed = false;
  const updated = content.replace(
    /^(last_updated:\s*)(\d{4}-\d{2}-\d{2})\s*$/m,
    (_, prefix: string, date: string) => {
      changed = true;
      return `${prefix}${date}T00:00:00Z`;
    },
  );
  return { updated, changed };
}

function migrateWikilinks(
  content: string,
  file: string,
  wikiDir: string,
  slugTargets: Map<string, string[]>,
): { updated: string; changed: boolean } {
  let changed = false;
  const updated = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    changed = true;
    const trimmedTarget = stripMarkdownExtension(target.trim());
    const slug = slugify(trimmedTarget);
    const text = (label ?? target).trim();

    let wikiRootTarget: string;
    if (trimmedTarget.includes('/')) {
      wikiRootTarget = `${trimmedTarget
        .split('/')
        .map((part) => slugify(part))
        .join('/')}.md`;
    } else {
      const matches = slugTargets.get(slug) ?? [];
      wikiRootTarget = matches.length === 1 ? matches[0] : `concepts/${slug}.md`;
    }

    return `[${text}](${markdownLinkFromWikiRoot(wikiDir, file, wikiRootTarget)})`;
  });
  return { updated, changed };
}

export type MigrateOptions = {
  dryRun?: boolean;
};

export function runMigrate(ctx: WikiContext, options: MigrateOptions = {}): number {
  const { wikiDir } = ctx;
  const dryRun = options.dryRun ?? false;

  const pages = walkMdSkipDirs(wikiDir, SKIP_DIRS);
  const slugTargets = buildSlugTargetMap(pages, wikiDir);
  let migrated = 0;

  for (const file of pages) {
    const rel = relative(wikiDir, file).replace(/\\/g, '/');
    if (META_SKIP.has(rel.split('/').pop() ?? '')) continue;

    let content = readFileSync(file, 'utf8');
    let changed = false;

    const statusResult = migrateStatus(content);
    content = statusResult.updated;
    changed ||= statusResult.changed;

    const timestampResult = migrateTimestamps(content);
    content = timestampResult.updated;
    changed ||= timestampResult.changed;

    const linkResult = migrateWikilinks(content, file, wikiDir, slugTargets);
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

  return 0;
}
