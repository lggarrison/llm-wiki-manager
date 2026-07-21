import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runMigrate } from '../../src/wiki/migrate-pages.js';
import { resolveWikiContext } from '../../src/wiki/context.js';
import { fm, writePage } from '../helpers/wiki.js';

const tmpDirs: string[] = [];
function makeTmpProject(): { root: string; wikiDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'llm-wiki-migrate-test-'));
  tmpDirs.push(root);
  const wikiDir = join(root, 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  return { root, wikiDir };
}

function runMigrateWiki(wikiDir: string, args: { dryRun?: boolean } = {}): void {
  const ctx = resolveWikiContext({ cwd: wikiDir, wikiDir });
  const status = runMigrate(ctx, args);
  expect(status).toBe(0);
}

afterEach(async () => {
  const { rmSync } = await import('fs');
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('migrate-pages', () => {
  it('remaps draft → wip and stable → active', () => {
    const { wikiDir } = makeTmpProject();
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

    runMigrateWiki(wikiDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'draft-page.md'), 'utf8')).toContain(
      'status: wip',
    );
    expect(readFileSync(join(wikiDir, 'concepts', 'stable-page.md'), 'utf8')).toContain(
      'status: active',
    );
  });

  it('converts a date-only last_updated to a UTC ISO timestamp', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/dated.md',
      fm({ title: 'Dated', type: 'concept', last_updated: '2026-01-15' }) + '\n# Dated\n',
    );

    runMigrateWiki(wikiDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'dated.md'), 'utf8')).toContain(
      'last_updated: 2026-01-15T00:00:00Z',
    );
  });

  it('leaves an existing timestamp last_updated untouched', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/stamped.md',
      fm({ title: 'Stamped', type: 'concept', last_updated: '2026-01-15T09:30:00Z' }) +
        '\n# Stamped\n',
    );

    runMigrateWiki(wikiDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'stamped.md'), 'utf8')).toContain(
      'last_updated: 2026-01-15T09:30:00Z',
    );
  });

  it('converts wikilinks to markdown links', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/links.md',
      fm({ title: 'Links', type: 'concept' }) + '\nSee [[caching]] for details.\n',
    );

    runMigrateWiki(wikiDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'links.md'), 'utf8')).toContain(
      '[caching](caching.md)',
    );
    expect(readFileSync(join(wikiDir, 'concepts', 'links.md'), 'utf8')).not.toContain(
      '[[caching]]',
    );
  });

  it('converts path-style wikilinks to paths relative to the source page', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'entities/foo.md',
      fm({ title: 'Foo', type: 'overview', tags: ['foo'] }) + '\n# Foo\n',
    );
    writePage(
      wikiDir,
      'entities/bar.md',
      fm({ title: 'Bar', type: 'overview', tags: ['bar'] }) + '\nSee [[entities/foo|Foo]].\n',
    );

    runMigrateWiki(wikiDir);

    expect(readFileSync(join(wikiDir, 'entities', 'bar.md'), 'utf8')).toContain('[Foo](foo.md)');
  });

  it('prefers an existing bare-slug target outside concepts when it is unambiguous', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'entities/foo.md',
      fm({ title: 'Foo', type: 'overview', tags: ['foo'] }) + '\n# Foo\n',
    );
    writePage(
      wikiDir,
      'concepts/links.md',
      fm({ title: 'Links', type: 'concept' }) + '\nSee [[foo|Foo]].\n',
    );

    runMigrateWiki(wikiDir);

    expect(readFileSync(join(wikiDir, 'concepts', 'links.md'), 'utf8')).toContain(
      '[Foo](../entities/foo.md)',
    );
  });

  it('does not rewrite legacy syntax inside fenced code examples', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/caching.md',
      fm({ title: 'Caching', type: 'concept' }) + '\n# Caching\n',
    );
    writePage(
      wikiDir,
      'concepts/examples.md',
      fm({
        status: 'draft',
        title: 'Examples',
        type: 'concept',
        last_updated: '2026-01-15',
      }) +
        [
          '',
          '# Examples',
          '',
          'See [[caching]] for real docs.',
          '',
          '```markdown',
          'status: draft',
          'last_updated: 2026-01-15',
          'Use [[caching]] in Obsidian examples.',
          '```',
          '',
        ].join('\n'),
    );

    runMigrateWiki(wikiDir);

    const content = readFileSync(join(wikiDir, 'concepts', 'examples.md'), 'utf8');
    expect(content).toContain('status: wip');
    expect(content).toContain('last_updated: 2026-01-15T00:00:00Z');
    expect(content).toContain('[caching](caching.md)');
    expect(content).toContain(
      [
        '```markdown',
        'status: draft',
        'last_updated: 2026-01-15',
        'Use [[caching]] in Obsidian examples.',
        '```',
      ].join('\n'),
    );
  });

  it('does not rewrite legacy syntax inside inline code examples', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/caching.md',
      fm({ title: 'Caching', type: 'concept' }) + '\n# Caching\n',
    );
    writePage(
      wikiDir,
      'concepts/examples.md',
      fm({ title: 'Examples', type: 'concept' }) +
        [
          '',
          '# Examples',
          '',
          'See [[caching]] for real docs.',
          '',
          'Document literal syntax with `[[caching]]` and ``[[caching|Caching]]`` examples.',
          '',
        ].join('\n'),
    );

    runMigrateWiki(wikiDir);

    const content = readFileSync(join(wikiDir, 'concepts', 'examples.md'), 'utf8');
    expect(content).toContain('[caching](caching.md)');
    expect(content).toContain(
      'Document literal syntax with `[[caching]]` and ``[[caching|Caching]]`` examples.',
    );
  });

  it('supports --dry-run without writing files', () => {
    const { wikiDir } = makeTmpProject();
    writePage(
      wikiDir,
      'concepts/keep.md',
      fm({ status: 'draft', title: 'Keep', type: 'concept' }) + '\n# Keep\n',
    );

    runMigrateWiki(wikiDir, { dryRun: true });

    expect(readFileSync(join(wikiDir, 'concepts', 'keep.md'), 'utf8')).toContain('status: draft');
  });
});
