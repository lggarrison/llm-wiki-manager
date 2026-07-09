import { describe, it, expect } from 'vitest';
import {
  assertInitCompatibleWithExistingScaffold,
  parseInitArgs,
} from '../../src/commands/init.js';
import type { InstallConfig } from '../../src/utils/fs.js';

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

describe('assertInitCompatibleWithExistingScaffold', () => {
  const config = (version: string): InstallConfig => ({
    version,
    projectName: 'acme',
    wikiDir: 'wiki',
    focusDirs: ['src'],
  });

  it('allows first init when no install config exists', () => {
    expect(() => assertInitCompatibleWithExistingScaffold(null, '1.0.0')).not.toThrow();
  });

  it('allows re-init with an equal or newer running CLI', () => {
    expect(() => assertInitCompatibleWithExistingScaffold(config('1.0.0'), '1.0.0')).not.toThrow();
    expect(() => assertInitCompatibleWithExistingScaffold(config('1.0.0'), '1.0.1')).not.toThrow();
  });

  it('refuses to run older init against a newer scaffold config', () => {
    expect(() => assertInitCompatibleWithExistingScaffold(config('1.0.1'), '1.0.0')).toThrow(
      /Refusing to run init with llm-wiki-manager v1\.0\.0/,
    );
  });
});
