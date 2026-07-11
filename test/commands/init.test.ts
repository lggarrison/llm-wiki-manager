import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import { getInitPromptDefaults, parseInitArgs } from '../../src/commands/init.js';

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

describe('getInitPromptDefaults', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeProject(name: string): string {
    const dir = mkdtempSync(join(tmpdir(), name));
    dirs.push(dir);
    return dir;
  }

  it('uses first-time init defaults when no install config exists', () => {
    const dir = makeProject('llm-wiki-init-defaults-');

    expect(getInitPromptDefaults(dir)).toEqual({
      projectName: expect.stringMatching(/^llm-wiki-init-defaults-/),
      wikiDir: 'wiki',
      focusDirs: 'src',
    });
  });

  it('prefills interactive re-init prompts from the existing install config', () => {
    const dir = makeProject('llm-wiki-init-existing-');
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({
        version: '1.0.3',
        projectName: 'Custom App',
        wikiDir: 'docs/wiki',
        focusDirs: ['api', 'packages/core'],
      }),
    );

    expect(getInitPromptDefaults(dir)).toEqual({
      projectName: 'Custom App',
      wikiDir: 'docs/wiki',
      focusDirs: 'api, packages/core',
    });
  });
});
