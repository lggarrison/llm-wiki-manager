import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { runBuild, runCheck } from './build-index.js';
import { resolveWikiContext } from './context.js';

const tmpDirs: string[] = [];

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-build-test-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'wiki'), { recursive: true });
  return dir;
}

function writeWikiPage(repoRoot: string, relPath: string, content: string): void {
  const fullPath = join(repoRoot, 'wiki', ...relPath.split('/'));
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runBuild', () => {
  it('preserves custom index preamble while regenerating stale tables', async () => {
    const repoRoot = makeRepo();
    writeWikiPage(
      repoRoot,
      'index.md',
      [
        '# Team Knowledge Index',
        '',
        'Keep this hand-written overview for onboarding.',
        '',
        '---',
        '',
        'This separator is part of the custom preamble.',
        '',
        '---',
        '',
        '## Overview & Hub Pages',
        '',
        '| Title | Status | Updated |',
        '| --- | --- | --- |',
        '| Delete me | stale | 2026-01-01T00:00:00Z |',
        '',
      ].join('\n'),
    );
    writeWikiPage(
      repoRoot,
      'concepts/alpha.md',
      [
        '---',
        'type: concept',
        'title: Alpha',
        'last_updated: 2026-07-06T00:00:00Z',
        'tags: [alpha]',
        'status: active',
        '---',
        '',
        '# Alpha',
        '',
      ].join('\n'),
    );

    const ctx = resolveWikiContext({ cwd: repoRoot, repoRoot, wikiDir: 'wiki' });
    await runBuild(ctx);

    const output = readFileSync(join(repoRoot, 'wiki', 'index.md'), 'utf8');
    expect(output).toContain('Keep this hand-written overview for onboarding.');
    expect(output).toContain('This separator is part of the custom preamble.');
    expect(output).not.toContain('Delete me');
    expect(output).toContain('[Alpha](concepts/alpha.md)');
    await expect(runCheck(ctx)).resolves.toBe(0);
  });
});
