import { describe, expect, it } from 'vitest';
import { flagValue } from './context.js';

describe('flagValue', () => {
  it('returns the following token for a present flag', () => {
    expect(flagValue(['--wiki-dir', 'docs/wiki'], '--wiki-dir')).toBe('docs/wiki');
  });

  it('throws when a present flag has no value', () => {
    expect(() => flagValue(['--wiki-dir'], '--wiki-dir')).toThrow('--wiki-dir requires a value');
  });

  it('throws when the following token is another flag', () => {
    expect(() => flagValue(['--wiki-dir', '--repo-root', '/repo'], '--wiki-dir')).toThrow(
      '--wiki-dir requires a value',
    );
  });
});
