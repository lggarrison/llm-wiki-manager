import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { makeTmpWikiDir, cleanup, writePage, fm, scriptPath } from '../helpers/wiki.js';

const dirs: string[] = [];
function newWikiDir(): string {
  const dir = makeTmpWikiDir();
  dirs.push(dir);
  writeFileSync(join(dir, 'index.md'), '# Wiki Index\n');
  writeFileSync(join(dir, 'log.md'), '# Log\n');
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) cleanup(dir);
});

function runLint(wikiDir: string, extraArgs: string[] = []) {
  return spawnSync('node', [scriptPath('lint.mjs'), '--wiki-dir', wikiDir, ...extraArgs], {
    encoding: 'utf8',
  });
}

describe('lint.mjs', () => {
  it('exits 0 for a wiki with no pages', () => {
    const dir = newWikiDir();
    const result = runLint(dir);
    expect(result.status).toBe(0);
  });

  it('exits 0 for a single valid, fully-linked page', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }) + '\nBody text.\n');
    const result = runLint(dir);
    expect(result.status).toBe(0);
  });

  it('fails when frontmatter is missing', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', 'No frontmatter here.\n');
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('missing frontmatter');
  });

  it('fails when a required field is missing', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', '---\ntype: concept\ntitle: A\n---\n');
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('missing required frontmatter field');
  });

  it('fails on an invalid type', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'bogus' }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('invalid type');
  });

  it('fails on an invalid status', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ status: 'draft' }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('invalid status');
  });

  it('allows pages without optional frontmatter fields', () => {
    const dir = newWikiDir();
    writePage(
      dir,
      'concepts/a.md',
      '---\ntype: concept\ntitle: A\nlast_updated: 2026-01-01T00:00:00Z\n---\n',
    );
    const result = runLint(dir);
    expect(result.status).toBe(0);
  });

  it('fails when type is placed in the wrong directory', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'entity', title: 'A' }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('must be placed at entities/<slug>.md');
  });

  it('fails on non-kebab-case filenames', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/BadName.md', fm({ title: 'Bad' }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('lowercase kebab-case');
  });

  it('fails when code_refs path does not exist', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ code_refs: ['missing/file.ts'] }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('code_refs: path does not exist');
  });

  it('fails on body links to non-wiki paths', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm() + '\n[src](../src/foo.ts)\n');
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('body link must target a wiki page');
  });

  it('fails on a malformed last_updated value', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ last_updated: 'Jan 1 2026' }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('last_updated must be a UTC ISO timestamp');
  });

  it('fails on a date-only last_updated (timestamp required)', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ last_updated: '2026-01-01' }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('last_updated must be a UTC ISO timestamp');
  });

  it('fails when a related: path does not resolve', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ related: ['concepts/missing.md'] }));
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('related: path does not exist');
  });

  it('fails on a broken body link', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm() + '\n[broken](missing.md)\n');
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('broken body link');
  });

  it('fails on a wikilink', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm() + '\nSee [[Other Page]].\n');
    const result = runLint(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('wikilink');
  });

  it('warns (not errors) when related: has no corresponding body link', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/b.md', fm({ type: 'concept', title: 'B' }));
    writePage(dir, 'concepts/a.md', fm({ related: ['concepts/b.md'] }));
    const result = runLint(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('has no corresponding body link');
  });

  it('warns on orphaned non-hub pages', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', fm({ type: 'concept', title: 'A' }));
    const result = runLint(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('orphaned page');
  });

  it('does not flag hub/overview pages as orphans', () => {
    const dir = newWikiDir();
    writePage(dir, 'raw/raw.md', fm({ type: 'hub', title: 'Raw Hub' }));
    const result = runLint(dir);
    expect(result.stdout).not.toContain('orphaned page');
  });

  it('--warn-only exits 0 even with errors present', () => {
    const dir = newWikiDir();
    writePage(dir, 'concepts/a.md', 'No frontmatter here.\n');
    const result = runLint(dir, ['--warn-only']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('missing frontmatter');
  });

  it('ignores raw artifact files without frontmatter', () => {
    const dir = newWikiDir();
    writePage(dir, 'raw/articles/notes.md', 'not frontmatter, should be ignored');
    const result = runLint(dir);
    expect(result.status).toBe(0);
  });
});
