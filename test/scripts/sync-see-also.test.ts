import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { makeTmpWikiDir, cleanup, writePage, fm, scriptPath } from '../helpers/wiki.js';

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
  return spawnSync('node', [scriptPath('sync-see-also.mjs'), '--wiki-dir', wikiDir, ...extraArgs], {
    encoding: 'utf8',
  });
}

describe('sync-see-also.mjs', () => {
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
      fm({ related: ['concepts/b.md', 'concepts/c.md'] }) +
        '\n## See also\n\n- [B Page](b.md)\n'
    );

    runSync(dir);

    const content = readFileSync(aPath, 'utf8');
    expect(content.match(/## See also/g)?.length).toBe(1);
    expect(content).toContain('[C Page](c.md)');
  });

  it('does not modify a page whose related links are already present in the body', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'hub', title: 'B Page' }));
    const aPath = writePage(
      dir,
      'concepts/a.md',
      fm({ related: ['concepts/b.md'] }) + '\nSee [B Page](b.md) for more.\n'
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
});
