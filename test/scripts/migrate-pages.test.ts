import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { buildTemplateVars, upgradeScripts } from '../../src/utils/fs.js';
import { fm, writePage } from '../helpers/wiki.js';

const tmpDirs: string[] = [];
function makeTmpProject(): { root: string; wikiDir: string; scriptsDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'llm-wiki-migrate-test-'));
  tmpDirs.push(root);
  const wikiDir = join(root, 'wiki');
  const scriptsDir = join(root, 'scripts', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  const vars = buildTemplateVars({
    projectName: 'acme',
    wikiDir: 'wiki',
    scriptsDir: 'scripts/wiki',
    focusDirs: [],
  });
  upgradeScripts(scriptsDir, vars);
  return { root, wikiDir, scriptsDir };
}

function runMigrate(wikiDir: string, scriptsDir: string, args: string[] = []): void {
  const result = spawnSync(
    process.execPath,
    [join(scriptsDir, 'migrate-pages.mjs'), '--wiki-dir', wikiDir, ...args],
    { encoding: 'utf8' },
  );
  expect(result.status).toBe(0);
}

afterEach(async () => {
  const { rmSync } = await import('fs');
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('migrate-pages.mjs', () => {
  it('remaps draft → wip and stable → active', () => {
    const { wikiDir, scriptsDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/draft-page.md',
      fm({ status: 'draft', title: 'Draft', type: 'concept' }) + '\n# Draft\n',
    );
    writePage(
      wikiDir,
      'concepts/stable-page.md',
      fm({ status: 'stable', title: 'Stable', type: 'concept' }) + '\n# Stable\n',
    );

    runMigrate(wikiDir, scriptsDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'draft-page.md'), 'utf8')).toContain(
      'status: wip',
    );
    expect(readFileSync(join(wikiDir, 'concepts', 'stable-page.md'), 'utf8')).toContain(
      'status: active',
    );
  });

  it('converts a date-only last_updated to a UTC ISO timestamp', () => {
    const { wikiDir, scriptsDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/dated.md',
      fm({ title: 'Dated', type: 'concept', last_updated: '2026-01-15' }) + '\n# Dated\n',
    );

    runMigrate(wikiDir, scriptsDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'dated.md'), 'utf8')).toContain(
      'last_updated: 2026-01-15T00:00:00Z',
    );
  });

  it('leaves an existing timestamp last_updated untouched', () => {
    const { wikiDir, scriptsDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/stamped.md',
      fm({ title: 'Stamped', type: 'concept', last_updated: '2026-01-15T09:30:00Z' }) +
        '\n# Stamped\n',
    );

    runMigrate(wikiDir, scriptsDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'stamped.md'), 'utf8')).toContain(
      'last_updated: 2026-01-15T09:30:00Z',
    );
  });

  it('converts wikilinks to markdown links', () => {
    const { wikiDir, scriptsDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/links.md',
      fm({ title: 'Links', type: 'concept' }) + '\nSee [[caching]] for details.\n',
    );

    runMigrate(wikiDir, scriptsDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'links.md'), 'utf8')).toContain(
      '[caching](concepts/caching.md)',
    );
    expect(readFileSync(join(wikiDir, 'concepts', 'links.md'), 'utf8')).not.toContain(
      '[[caching]]',
    );
  });

  it('supports --dry-run without writing files', () => {
    const { wikiDir, scriptsDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/keep.md',
      fm({ status: 'draft', title: 'Keep', type: 'concept' }) + '\n# Keep\n',
    );

    runMigrate(wikiDir, scriptsDir, ['--dry-run']);

    expect(readFileSync(join(wikiDir, 'concepts', 'keep.md'), 'utf8')).toContain('status: draft');
  });
});
