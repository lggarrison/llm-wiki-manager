import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { shouldSkipWikiPath, walkMd, walkMdSkipDirs } from './walk.js';
import { RAW_ARTIFACT_DIRS } from './constants.js';

const tmpDirs: string[] = [];

function makeWikiDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-walk-'));
  tmpDirs.push(dir);
  return dir;
}

function touch(wikiDir: string, rel: string): string {
  const full = join(wikiDir, ...rel.split('/'));
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, '# page\n');
  return full;
}

function relPath(wikiDir: string, full: string): string {
  return full
    .replace(wikiDir, '')
    .replace(/^[/\\]/, '')
    .replace(/\\/g, '/');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('shouldSkipWikiPath', () => {
  it('does not skip pages whose path contains "raw" as a substring', () => {
    const wikiDir = makeWikiDir();
    expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, 'concepts/drawing.md'))).toBe(false);
    expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, 'concepts/strawberry.md'))).toBe(false);
    expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, 'entities/billing.md'))).toBe(false);
  });

  it('does not skip raw/raw.md hub page', () => {
    const wikiDir = makeWikiDir();
    expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, 'raw/raw.md'))).toBe(false);
  });

  it('skips raw artifact subdirectories', () => {
    const wikiDir = makeWikiDir();
    for (const sub of RAW_ARTIFACT_DIRS) {
      expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, `raw/${sub}/notes.md`))).toBe(true);
    }
  });

  it('skips archive paths and .obsidian paths', () => {
    const wikiDir = makeWikiDir();
    expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, 'archive/old.md'))).toBe(true);
    expect(shouldSkipWikiPath(wikiDir, touch(wikiDir, '.obsidian/workspace.md'))).toBe(true);
  });
});

describe('walkMd', () => {
  it('includes drawing.md and raw/raw.md but excludes raw artifact files', () => {
    const wikiDir = makeWikiDir();
    touch(wikiDir, 'concepts/drawing.md');
    touch(wikiDir, 'raw/raw.md');
    touch(wikiDir, 'raw/articles/notes.md');

    const rels = walkMd(wikiDir)
      .map((f) => relPath(wikiDir, f))
      .sort();
    expect(rels).toContain('concepts/drawing.md');
    expect(rels).toContain('raw/raw.md');
    expect(rels).not.toContain('raw/articles/notes.md');
  });
});

describe('walkMdSkipDirs', () => {
  it('skips top-level raw/ and archive/ but still walks concepts/', () => {
    const wikiDir = makeWikiDir();
    touch(wikiDir, 'concepts/drawing.md');
    touch(wikiDir, 'raw/raw.md');
    touch(wikiDir, 'archive/old.md');

    const rels = walkMdSkipDirs(wikiDir, ['raw', 'archive', '.obsidian'])
      .map((f) => relPath(wikiDir, f))
      .sort();

    expect(rels).toContain('concepts/drawing.md');
    expect(rels).not.toContain('raw/raw.md');
    expect(rels).not.toContain('archive/old.md');
  });
});
