import { readFileSync, writeFileSync } from 'fs';
import { relative } from 'path';
import { walkMdSkipDirs } from './walk.js';
import { META_SKIP } from './constants.js';
import type { WikiContext } from './context.js';

const STATUS_MAP: Record<string, string> = {
  draft: 'wip',
  stable: 'active',
  archived: 'deprecated',
};

const SKIP_DIRS = ['raw', 'archive'];

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

function migrateWikilinks(content: string): { updated: string; changed: boolean } {
  let changed = false;
  const updated = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    changed = true;
    const slug = target.trim().replace(/\s+/g, '-').toLowerCase();
    const text = (label ?? target).trim();
    if (target.includes('/')) {
      return `[${text}](${target}.md)`;
    }
    return `[${text}](concepts/${slug}.md)`;
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

    const linkResult = migrateWikilinks(content);
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
