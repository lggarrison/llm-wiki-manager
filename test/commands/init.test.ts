import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import { getInitFlagDefaults, parseInitArgs } from '../../src/commands/init.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-init-test-'));
  tmpDirs.push(dir);
  return dir;
}

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

  it('uses provided defaults for omitted optional flags', () => {
    const values = parseInitArgs(['--project-name', 'acme'], {
      wikiDir: 'docs/wiki',
      focusDirs: 'src,packages/core',
    });

    expect(values).toEqual({
      projectName: 'acme',
      wikiDir: 'docs/wiki',
      focusDirs: 'src,packages/core',
    });
  });

  it('prefers explicit optional flags over provided defaults', () => {
    const values = parseInitArgs(
      ['--project-name', 'acme', '--wiki-dir', 'knowledge', '--focus-dirs', 'apps/web'],
      {
        wikiDir: 'docs/wiki',
        focusDirs: 'src,packages/core',
      },
    );

    expect(values).toEqual({
      projectName: 'acme',
      wikiDir: 'knowledge',
      focusDirs: 'apps/web',
    });
  });
});

describe('getInitFlagDefaults', () => {
  it('uses first-time non-interactive defaults when no install exists', () => {
    const dir = makeTmpDir();

    expect(getInitFlagDefaults(dir)).toEqual({
      wikiDir: 'wiki',
      focusDirs: '',
    });
  });

  it('uses existing install config for non-interactive re-init defaults', () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, 'docs', 'wiki'), { recursive: true });
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({
        version: '1.0.3',
        projectName: 'Custom App',
        wikiDir: 'docs/wiki',
        focusDirs: ['src', 'packages/core'],
      }),
    );

    expect(getInitFlagDefaults(dir)).toEqual({
      wikiDir: 'docs/wiki',
      focusDirs: 'src,packages/core',
    });
  });
});
