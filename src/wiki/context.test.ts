import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { resolveWikiDir } from './context.js';

const tmpDirs: string[] = [];

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-context-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveWikiDir', () => {
  it('infers nested wiki paths from root AGENTS.md when install config is absent', () => {
    const dir = makeProjectDir();
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '<!-- llm-wiki-manager -->\nRead [`docs/wiki/AGENTS.md`](docs/wiki/AGENTS.md)\n',
    );
    mkdirSync(join(dir, 'docs', 'wiki'), { recursive: true });

    expect(resolveWikiDir(dir)).toBe(resolve(dir, 'docs/wiki'));
  });
});
