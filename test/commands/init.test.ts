import { describe, it, expect } from 'vitest';
import { parseInitArgs } from '../../src/commands/init.js';

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

  it('rejects missing required values before treating the next flag as data', () => {
    expect(() => parseInitArgs(['--project-name', '--wiki-dir', 'docs'])).toThrow(
      '--project-name requires a value',
    );
  });

  it('rejects missing optional values before treating the next flag as data', () => {
    expect(() =>
      parseInitArgs(['--project-name', 'acme', '--wiki-dir', '--focus-dirs', 'src']),
    ).toThrow('--wiki-dir requires a value');
  });

  it('rejects unknown init options in non-interactive mode', () => {
    expect(() => parseInitArgs(['--project-name', 'acme', '--wiki-dr', 'docs'])).toThrow(
      'Unknown init option: --wiki-dr',
    );
  });
});
