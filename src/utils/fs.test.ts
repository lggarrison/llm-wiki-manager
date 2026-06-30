import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { interpolate, amendFile, copyTemplate, templatePath } from './fs.js';

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-fs-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  const { rmSync } = await import('fs');
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('interpolate', () => {
  it('substitutes a known placeholder', () => {
    expect(interpolate('Hello {{NAME}}', { NAME: 'World' })).toBe('Hello World');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(interpolate('Hello {{NAME}}', {})).toBe('Hello {{NAME}}');
  });

  it('substitutes multiple distinct placeholders', () => {
    expect(interpolate('{{A}}-{{B}}', { A: '1', B: '2' })).toBe('1-2');
  });

  it('substitutes repeated occurrences of the same placeholder', () => {
    expect(interpolate('{{X}} and {{X}}', { X: 'y' })).toBe('y and y');
  });

  it('returns the string unchanged when there are no placeholders', () => {
    expect(interpolate('no placeholders here', { X: 'y' })).toBe('no placeholders here');
  });

  it('handles an empty string', () => {
    expect(interpolate('', { X: 'y' })).toBe('');
  });
});

describe('amendFile', () => {
  it('creates the file when it does not exist', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    const result = amendFile(target, '# Section\n\nbody');
    expect(result).toBe(true);
    const content = readFileSync(target, 'utf8');
    expect(content).toContain('<!-- llm-wiki-manager -->');
    expect(content).toContain('# Section\n\nbody');
  });

  it('appends with a delimiter and downgrades the H1 when the file already exists', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(target, '# Existing project notes\n\nSome content.\n');

    const result = amendFile(target, '# LLM Wiki\n\nWiki instructions.');
    expect(result).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('# Existing project notes');
    expect(content).toContain('<!-- llm-wiki-manager -->');
    expect(content).toContain('## LLM Wiki');
    expect(content).not.toMatch(/^# LLM Wiki/m);
  });

  it('is idempotent: a second call is a no-op once the delimiter is present', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');

    amendFile(target, '# LLM Wiki\n\nWiki instructions.');
    const afterFirst = readFileSync(target, 'utf8');

    const result = amendFile(target, '# LLM Wiki\n\nDifferent instructions.');
    expect(result).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe(afterFirst);
  });
});

describe('copyTemplate', () => {
  it('copies a directory tree to the destination', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    writeFileSync(join(src, 'a.md'), '# A');
    mkdirSync(join(src, 'nested'), { recursive: true });
    writeFileSync(join(src, 'nested', 'b.md'), '# B');

    copyTemplate(src, dest);

    expect(existsSync(join(dest, 'a.md'))).toBe(true);
    expect(existsSync(join(dest, 'nested', 'b.md'))).toBe(true);
  });

  it('interpolates placeholders in copied .md/.mjs/.js files', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    writeFileSync(join(src, 'page.md'), 'Project: {{PROJECT_NAME}}');
    writeFileSync(join(src, 'script.mjs'), '// {{PROJECT_NAME}}');

    copyTemplate(src, dest, { PROJECT_NAME: 'acme' });

    expect(readFileSync(join(dest, 'page.md'), 'utf8')).toBe('Project: acme');
    expect(readFileSync(join(dest, 'script.mjs'), 'utf8')).toBe('// acme');
  });

  it('does not modify files when no vars are given', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    writeFileSync(join(src, 'page.md'), 'Project: {{PROJECT_NAME}}');

    copyTemplate(src, dest);

    expect(readFileSync(join(dest, 'page.md'), 'utf8')).toBe('Project: {{PROJECT_NAME}}');
  });
});

describe('templatePath', () => {
  it('resolves to a path under the package templates directory', () => {
    const p = templatePath('wiki', 'schema.md');
    expect(p.endsWith(join('templates', 'wiki', 'schema.md'))).toBe(true);
  });
});
