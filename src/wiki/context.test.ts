import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { normalizeWikiDir, resolveWikiContext, resolveWikiDir } from './context.js';
import { writeInstallConfig } from '../utils/fs.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-context-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('normalizeWikiDir', () => {
  it('normalizes safe child wiki directories', () => {
    expect(normalizeWikiDir('wiki')).toBe('wiki');
    expect(normalizeWikiDir('./docs/wiki')).toBe('docs/wiki');
  });

  it('rejects paths that do not stay in a named child directory', () => {
    const unsafe = ['', '   ', '.', '..', '../docs', 'docs/../wiki', resolve(tmpdir(), 'wiki')];

    for (const wikiDir of unsafe) {
      expect(() => normalizeWikiDir(wikiDir)).toThrow(/Unsafe wiki directory/);
    }
  });
});

describe('resolveWikiDir', () => {
  it('resolves explicit and configured wiki dirs under the project root', () => {
    const dir = makeTmpDir();
    expect(resolveWikiDir(dir, 'docs/wiki')).toBe(join(dir, 'docs', 'wiki'));

    writeInstallConfig(dir, {
      version: '1.0.0',
      projectName: 'acme',
      wikiDir: './knowledge',
      focusDirs: [],
    });
    expect(resolveWikiDir(dir)).toBe(join(dir, 'knowledge'));
  });

  it('rejects unsafe configured wiki dirs before callers write files', () => {
    const dir = makeTmpDir();
    writeInstallConfig(dir, {
      version: '1.0.0',
      projectName: 'acme',
      wikiDir: '.',
      focusDirs: [],
    });

    expect(() => resolveWikiDir(dir)).toThrow(/Unsafe wiki directory/);
  });
});

describe('resolveWikiContext', () => {
  it('resolves --wiki-dir relative to --repo-root instead of the shell cwd', () => {
    const repoRoot = makeTmpDir();
    const cwd = join(repoRoot, 'packages', 'app');
    mkdirSync(cwd, { recursive: true });

    const ctx = resolveWikiContext({ cwd, repoRoot, wikiDir: 'wiki' });

    expect(ctx.cwd).toBe(cwd);
    expect(ctx.repoRoot).toBe(repoRoot);
    expect(ctx.wikiDir).toBe(join(repoRoot, 'wiki'));
  });
});
