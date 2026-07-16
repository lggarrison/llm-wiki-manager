import { describe, it, expect } from 'vitest';
import {
  formatLintStagedPackageJsonSnippet,
  wikiLintStagedGlob,
} from '../../src/wiki/lint-staged-snippet.js';

describe('lint-staged snippet', () => {
  it('uses the wiki directory in the glob', () => {
    expect(wikiLintStagedGlob('docs')).toBe('docs/**/*.md');
  });

  it('produces a valid JSON fragment for package.json', () => {
    const snippet = formatLintStagedPackageJsonSnippet('wiki');
    const parsed = JSON.parse(`{${snippet}}`);
    expect(parsed['lint-staged']['wiki/**/*.md']).toEqual([
      'npm run wiki:build',
      'git add -- "wiki/index.md"',
      'npm run wiki:lint',
      'prettier --write',
    ]);
  });

  it('stages the index path for custom wiki directories', () => {
    const snippet = formatLintStagedPackageJsonSnippet('docs/wiki');
    const parsed = JSON.parse(`{${snippet}}`);
    expect(parsed['lint-staged']['docs/wiki/**/*.md']).toContain('git add -- "docs/wiki/index.md"');
  });
});
