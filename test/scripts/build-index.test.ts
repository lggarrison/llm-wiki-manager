import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import { readFileSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { makeTmpWikiDir, cleanup, writePage, fm, runWikiCliWithWikiDir } from '../helpers/wiki.js';
import { PACKAGE_ROOT } from '../helpers/paths.js';

const require = createRequire(import.meta.url);

const dirs: string[] = [];
function newWikiDir(): string {
  const dir = makeTmpWikiDir();
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) cleanup(dir);
});

function runBuild(wikiDir: string, extraArgs: string[] = []) {
  return runWikiCliWithWikiDir(wikiDir, 'build', extraArgs);
}

function runBuildWithRepoRoot(wikiDir: string, repoRoot: string) {
  return runBuild(wikiDir, ['--repo-root', repoRoot]);
}

function runCheck(wikiDir: string) {
  return runWikiCliWithWikiDir(wikiDir, 'check');
}

describe('build command', () => {
  it('writes index.md with "none yet" placeholders for an empty wiki', () => {
    const dir = newWikiDir();
    const result = runBuild(dir);
    expect(result.status).toBe(0);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toContain('# Wiki Index');
    expect(index).toContain('_(none yet)_');
  });

  it('lists a concept page under the Concepts section', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'Caching', tags: ['perf'] }));
    runBuild(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toMatch(/## Concepts/);
    expect(index).toContain('[Caching](concepts/a.md)');
    expect(index).toContain('perf');
  });

  it('lists a source page under the Sources section', () => {
    const dir = newWikiDir();
    writePage(dir, 'sources/s.md', fm({ type: 'source', title: 'RFC 9110' }));
    runBuild(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toMatch(/## Sources/);
    expect(index).toContain('[RFC 9110](sources/s.md)');
  });

  it('lists hub pages and entity overviews in separate sections', () => {
    const dir = newWikiDir();
    writePage(dir, 'raw/raw.md', fm({ type: 'hub', title: 'Hub Page' }));
    writePage(
      dir,
      'entities/billing.md',
      fm({ type: 'overview', title: 'Billing', tags: ['billing'] }),
    );
    runBuild(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toContain('[Hub Page](raw/raw.md)');
    expect(index).toMatch(/## Entities/);
    expect(index).toContain('[Billing](entities/billing.md)');
    expect(index).toContain('billing');
  });

  it('sorts pages within a section alphabetically by title', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/z.md', fm({ type: 'concept', title: 'Zebra' }));
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'Apple' }));
    runBuild(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index.indexOf('Apple')).toBeLessThan(index.indexOf('Zebra'));
  });

  it('excludes index.md, log.md, and schema.md from the listing', () => {
    const dir = newWikiDir();
    writeFileSync(join(dir, 'log.md'), '# Log\n');
    writeFileSync(join(dir, 'schema.md'), fm({ type: 'hub', title: 'Schema' }));
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuild(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).not.toContain('Schema');
  });

  it('ignores raw artifact files but indexes raw/raw.md hub', () => {
    const dir = newWikiDir();
    writePage(dir, 'raw/articles/notes.md', fm({ type: 'concept', title: 'Should Not Appear' }));
    writePage(dir, 'raw/raw.md', fm({ type: 'hub', title: 'Raw Hub' }));
    runBuild(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).not.toContain('Should Not Appear');
    expect(index).toContain('[Raw Hub](raw/raw.md)');
  });

  it('is idempotent across repeated runs', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuild(dir);
    const first = readFileSync(join(dir, 'index.md'), 'utf8');
    runBuild(dir);
    const second = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(second).toBe(first);
  });

  it('check passes when index.md matches the generated output', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuild(dir);
    const result = runCheck(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('up to date');
  });

  it('check fails when index.md is missing or stale', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));

    const missing = runCheck(dir);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('stale');

    runBuild(dir);
    writeFileSync(join(dir, 'index.md'), '# stale index\n');
    const stale = runCheck(dir);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('stale');
  });

  it('check does not modify index.md', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuild(dir);
    const before = readFileSync(join(dir, 'index.md'), 'utf8');
    runCheck(dir);
    expect(readFileSync(join(dir, 'index.md'), 'utf8')).toBe(before);
  });

  it('refuses to overwrite index.md through a symlink', () => {
    const dir = newWikiDir();
    const target = join(dir, '..', 'outside-index.md');
    writeFileSync(target, 'do not overwrite\n', 'utf8');
    symlinkSync(target, join(dir, 'index.md'));
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));

    const result = runBuild(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to write through symlink');
    expect(readFileSync(target, 'utf8')).toBe('do not overwrite\n');
  });

  it('check passes when git checked index.md out with CRLF line endings', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuild(dir);
    const indexPath = join(dir, 'index.md');
    const lf = readFileSync(indexPath, 'utf8');
    writeFileSync(indexPath, lf.replace(/\n/g, '\r\n'), 'utf8');
    const result = runCheck(dir);
    expect(result.status).toBe(0);
  });

  it('build output is unchanged by a second Prettier pass', async () => {
    const dir = newWikiDir();
    writePage(
      dir,
      'concepts/a.md',
      fm({ type: 'concept', title: 'Long Title Here', tags: ['tag-one', 'tag-two'] }),
    );
    runBuildWithRepoRoot(dir, PACKAGE_ROOT);
    const indexPath = join(dir, 'index.md');
    const built = readFileSync(indexPath, 'utf8');
    const prettier = require(require.resolve('prettier', { paths: [PACKAGE_ROOT] }));
    const reformatted = await prettier.format(built, { filepath: indexPath, parser: 'markdown' });
    expect(reformatted).toBe(built);
  });

  it('rebuild leaves prettier-formatted index.md unchanged (lint-staged idempotence)', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'Caching', tags: ['perf'] }));
    runBuildWithRepoRoot(dir, PACKAGE_ROOT);
    const first = readFileSync(join(dir, 'index.md'), 'utf8');
    runBuildWithRepoRoot(dir, PACKAGE_ROOT);
    const second = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(second).toBe(first);
  });
});
