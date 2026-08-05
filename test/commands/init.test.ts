import { afterEach, describe, it, expect, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { init, parseInitArgs } from '../../src/commands/init.js';

const tmpDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseInitArgs', () => {
  it('defaults --focus-dirs to empty when omitted', () => {
    const values = parseInitArgs(['--project-name', 'acme']);
    expect(values).toEqual({
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: '',
    });
  });

  it('reads explicit --focus-dirs', () => {
    const values = parseInitArgs([
      '--project-name',
      'acme',
      '--wiki-dir',
      'docs',
      '--focus-dirs',
      'src,api',
    ]);
    expect(values).toEqual({
      projectName: 'acme',
      wikiDir: 'docs',
      focusDirs: 'src,api',
    });
  });
});

describe('init command validation', () => {
  it('rejects incomplete install config before scaffolding files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-init-config-test-'));
    tmpDirs.push(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({ version: '1.0.0', wikiDir: 'wiki', focusDirs: [] }, null, 2) + '\n',
    );

    const originalArgv = process.argv;
    process.argv = [
      process.execPath,
      'llm-wiki-manager',
      'init',
      '--project-name',
      'acme',
      '--wiki-dir',
      'wiki',
    ];
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    try {
      await expect(init()).rejects.toThrow(/projectName/);
    } finally {
      process.argv = originalArgv;
    }
    expect(existsSync(join(dir, 'wiki'))).toBe(false);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });
});
