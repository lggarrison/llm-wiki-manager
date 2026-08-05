import { afterEach, describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseInitArgs } from '../../src/commands/init.js';
import { runBuiltCli } from '../helpers/cli.js';

const tmpDirs: string[] = [];

afterEach(() => {
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
  it('rejects incomplete install config before scaffolding files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-init-config-test-'));
    tmpDirs.push(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({ version: '1.0.0', wikiDir: 'wiki', focusDirs: [] }, null, 2) + '\n',
    );

    const result = runBuiltCli(dir, ['init', '--project-name', 'acme', '--wiki-dir', 'wiki']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.llm-wiki-manager.json is invalid');
    expect(result.stderr).toContain('projectName');
    expect(existsSync(join(dir, 'wiki'))).toBe(false);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });
});
