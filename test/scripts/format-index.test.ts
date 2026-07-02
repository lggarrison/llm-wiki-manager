import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { formatIndexMarkdown } from '../../src/wiki/format-index.js';

describe('formatIndexMarkdown', () => {
  it('uses bundled Prettier when the consumer repo has no local install', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-format-'));
    try {
      const content = '| Title | Status |\n| --- | --- |\n| Long Title Here | active |\n';
      const indexPath = join(dir, 'index.md');
      const formatted = await formatIndexMarkdown(content, indexPath, dir);
      expect(formatted).not.toBe(content);
      expect(formatted).toContain('Long Title Here');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
