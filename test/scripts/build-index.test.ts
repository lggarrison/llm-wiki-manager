import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
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

function runBuildIndex(wikiDir: string) {
  return spawnSync('node', [scriptPath('build-index.mjs'), '--wiki-dir', wikiDir], {
    encoding: 'utf8',
  });
}

describe('build-index.mjs', () => {
  it('writes index.md with "none yet" placeholders for an empty wiki', () => {
    const dir = newWikiDir();
    const result = runBuildIndex(dir);
    expect(result.status).toBe(0);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toContain('# Wiki Index');
    expect(index).toContain('_(none yet)_');
  });

  it('lists a concept page under the Concepts section', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'Caching', tags: ['perf'] }));
    runBuildIndex(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toMatch(/## Concepts/);
    expect(index).toContain('[Caching](concepts/a.md)');
    expect(index).toContain('perf');
  });

  it('lists a source page under the Sources section', () => {
    const dir = newWikiDir();
    writePage(dir, 'sources/s.md', fm({ type: 'source', title: 'RFC 9110' }));
    runBuildIndex(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toMatch(/## Sources/);
    expect(index).toContain('[RFC 9110](sources/s.md)');
  });

  it('lists overview and hub pages together', () => {
    const dir = newWikiDir();
    writePage(dir, 'hub.md', fm({ type: 'hub', title: 'Hub Page' }));
    writePage(dir, 'overview.md', fm({ type: 'overview', title: 'Overview Page' }));
    runBuildIndex(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).toContain('[Hub Page](hub.md)');
    expect(index).toContain('[Overview Page](overview.md)');
  });

  it('sorts pages within a section alphabetically by title', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/z.md', fm({ type: 'concept', title: 'Zebra' }));
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'Apple' }));
    runBuildIndex(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index.indexOf('Apple')).toBeLessThan(index.indexOf('Zebra'));
  });

  it('excludes index.md, log.md, and schema.md from the listing', () => {
    const dir = newWikiDir();
    writeFileSync(join(dir, 'log.md'), '# Log\n');
    writeFileSync(join(dir, 'schema.md'), fm({ type: 'hub', title: 'Schema' }));
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuildIndex(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).not.toContain('Schema');
  });

  it('ignores files under raw/', () => {
    const dir = newWikiDir();
    writePage(dir, 'raw/notes.md', fm({ type: 'concept', title: 'Should Not Appear' }));
    runBuildIndex(dir);
    const index = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(index).not.toContain('Should Not Appear');
  });

  it('is idempotent across repeated runs', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    runBuildIndex(dir);
    const first = readFileSync(join(dir, 'index.md'), 'utf8');
    runBuildIndex(dir);
    const second = readFileSync(join(dir, 'index.md'), 'utf8');
    expect(second).toBe(first);
  });
});
