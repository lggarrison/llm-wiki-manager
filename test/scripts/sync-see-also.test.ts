import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { makeTmpWikiDir, cleanup, writePage, fm, runWikiCliWithWikiDir } from '../helpers/wiki.js';

const dirs: string[] = [];
function newWikiDir(): string {
  const dir = makeTmpWikiDir();
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) cleanup(dir);
});

function runSync(wikiDir: string, extraArgs: string[] = []) {
  return runWikiCliWithWikiDir(wikiDir, 'sync', extraArgs);
}

describe('sync command', () => {
  it('appends a missing related link under a new "## See also" section', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(dir, 'concepts/a.md', fm({ related: ['concepts/b.md'] }) + '\nBody.\n');

    const result = runSync(dir);
    expect(result.status).toBe(0);

    const content = readFileSync(aPath, 'utf8');
    expect(content).toContain('## See also');
    expect(content).toContain('[B Page](b.md)');
  });

  it('appends to an existing "## See also" section instead of duplicating it', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    writePage(dir, 'concepts/c.md', fm({ type: 'hub', title: 'C Page' }));
    const aPath = writePage(
      dir,
      'concepts/a.md',
      fm({ related: ['concepts/b.md', 'concepts/c.md'] }) + '\n## See also\n\n- [B Page](b.md)\n',
    );

    runSync(dir);

    const content = readFileSync(aPath, 'utf8');
    expect(content.match(/## See also/g)?.length).toBe(1);
    expect(content).toContain('[C Page](c.md)');
  });

  it('inserts links before the next section when See also is not last', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(
      dir,
      'concepts/a.md',
      fm({ related: ['concepts/b.md'] }) +
        '\n## See also\n\n- [Existing](existing.md)\n\n## References\n\nSome refs.\n',
    );

    runSync(dir);

    const content = readFileSync(aPath, 'utf8');
    const seeAlsoIdx = content.indexOf('## See also');
    const refsIdx = content.indexOf('## References');
    const bLinkIdx = content.indexOf('[B Page](b.md)');
    expect(bLinkIdx).toBeGreaterThan(seeAlsoIdx);
    expect(bLinkIdx).toBeLessThan(refsIdx);
  });

  it('processes pages when wiki dir path contains "raw" as a substring', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crawler-wiki-'));
    dirs.push(dir);
    for (const sub of ['concepts', 'sources', 'entities', 'raw/articles']) {
      mkdirSync(join(dir, sub), { recursive: true });
    }
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    writePage(dir, 'concepts/drawing.md', fm({ type: 'concept', title: 'Drawing' }));
    const aPath = writePage(dir, 'concepts/a.md', fm({ related: ['concepts/b.md'] }) + '\nBody.\n');

    const result = runSync(dir);
    expect(result.status).toBe(0);
    expect(readFileSync(aPath, 'utf8')).toContain('[B Page](b.md)');
  });

  it('does not modify a page whose related links are already present in the body', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(
      dir,
      'concepts/a.md',
      fm({ related: ['concepts/b.md'] }) + '\nSee [B Page](b.md) for more.\n',
    );
    const before = readFileSync(aPath, 'utf8');

    const result = runSync(dir);

    expect(readFileSync(aPath, 'utf8')).toBe(before);
    expect(result.stdout).toContain('0 file(s) updated');
  });

  it('skips pages with no related: entries', () => {
    const dir = newWikiDir();
    const aPath = writePage(dir, 'concepts/a.md', fm({ related: [] }) + '\nBody.\n');
    const before = readFileSync(aPath, 'utf8');

    runSync(dir);

    expect(readFileSync(aPath, 'utf8')).toBe(before);
  });

  it('--dry does not write changes but reports what would change', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(dir, 'concepts/a.md', fm({ related: ['concepts/b.md'] }) + '\nBody.\n');
    const before = readFileSync(aPath, 'utf8');

    const result = runSync(dir, ['--dry']);

    expect(readFileSync(aPath, 'utf8')).toBe(before);
    expect(result.stdout).toContain('would add');
  });

  it('is idempotent: running twice does not duplicate links', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(dir, 'concepts/a.md', fm({ related: ['concepts/b.md'] }) + '\nBody.\n');

    runSync(dir);
    const afterFirst = readFileSync(aPath, 'utf8');
    runSync(dir);
    const afterSecond = readFileSync(aPath, 'utf8');

    expect(afterSecond).toBe(afterFirst);
    expect(afterFirst.match(/\[B Page\]\(b\.md\)/g)?.length).toBe(1);
  });

  it('inserts links inside "## See also" when it is not the last section', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(
      dir,
      'concepts/a.md',
      fm({ related: ['concepts/b.md'] }) +
        '\nBody.\n\n## See also\n\n- [Existing](existing.md)\n\n## History\n\nOld notes.\n',
    );
    writePage(dir, 'concepts/existing.md', fm({ type: 'hub', title: 'Existing' }));

    runSync(dir);

    const content = readFileSync(aPath, 'utf8');
    const linkIdx = content.indexOf('[B Page](b.md)');
    const historyIdx = content.indexOf('## History');
    expect(linkIdx).toBeGreaterThan(-1);
    expect(linkIdx).toBeLessThan(historyIdx);
    expect(content).toContain('Old notes.');
  });

  it('syncs pages whose filenames contain the substring "raw"', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const path = writePage(
      dir,
      'concepts/drawing.md',
      fm({ title: 'Drawing', related: ['concepts/b.md'] }) + '\nBody.\n',
    );

    const result = runSync(dir);
    expect(result.status).toBe(0);
    expect(readFileSync(path, 'utf8')).toContain('[B Page](b.md)');
  });
});
