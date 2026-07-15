import { describe, it, expect } from 'vitest';
import { parseFrontmatter, detectBlockListKeys } from './frontmatter.js';

function page(fm: string): string {
  return `---\n${fm}\n---\n\nBody.\n`;
}

describe('parseFrontmatter', () => {
  it('parses scalar values and inline arrays', () => {
    const fm = parseFrontmatter(page('type: concept\ntitle: A Page\ntags: [a, b]'));
    expect(fm).toEqual({ type: 'concept', title: 'A Page', tags: ['a', 'b'] });
  });

  it('parses frontmatter with a leading UTF-8 BOM', () => {
    const fm = parseFrontmatter(`\uFEFF${page('type: concept\ntitle: BOM Page')}`);
    expect(fm).toEqual({ type: 'concept', title: 'BOM Page' });
  });

  it('strips surrounding quotes from scalar values', () => {
    const fm = parseFrontmatter(page("title: 'Quoted Title'"));
    expect(fm?.title).toBe('Quoted Title');
  });

  it('returns null when there is no frontmatter block', () => {
    expect(parseFrontmatter('# Just a heading\n')).toBeNull();
  });

  it('parses a Prettier-wrapped inline array on the next line', () => {
    const fm = parseFrontmatter(page('type: concept\nrelated:\n  [concepts/a.md, concepts/b.md]'));
    expect(fm?.related).toEqual(['concepts/a.md', 'concepts/b.md']);
  });

  it('parses a Prettier-wrapped inline array spread over multiple lines', () => {
    const fm = parseFrontmatter(
      page('type: concept\ncode_refs:\n  [\n    src/a.ts,\n    src/b.ts,\n  ]\nstatus: active'),
    );
    expect(fm?.code_refs).toEqual(['src/a.ts', 'src/b.ts']);
    expect(fm?.status).toBe('active');
  });

  it('does not treat a scalar starting with a bracket as an array', () => {
    const fm = parseFrontmatter(page('title: [Draft] My Page\ntype: concept'));
    expect(fm?.title).toBe('[Draft] My Page');
    expect(fm?.type).toBe('concept');
  });
});

describe('detectBlockListKeys', () => {
  it('finds keys written as block-style YAML lists', () => {
    const keys = detectBlockListKeys(
      page('type: concept\nrelated:\n  - concepts/a.md\n  - concepts/b.md\ntags: [x]'),
    );
    expect(keys).toEqual(['related']);
  });

  it('detects block-style YAML lists after a leading UTF-8 BOM', () => {
    const keys = detectBlockListKeys(
      `\uFEFF${page('type: concept\nrelated:\n  - concepts/a.md\n  - concepts/b.md')}`,
    );
    expect(keys).toEqual(['related']);
  });

  it('does not flag inline or wrapped inline arrays', () => {
    const keys = detectBlockListKeys(page('tags: [a, b]\nrelated:\n  [concepts/a.md]'));
    expect(keys).toEqual([]);
  });

  it('returns an empty list when there is no frontmatter', () => {
    expect(detectBlockListKeys('- not frontmatter\n')).toEqual([]);
  });
});
