import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runUpgradeSteps } from './upgrade.js';
import type { InstallConfig } from './fs.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-upgrade-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function config(wikiDir: string): InstallConfig {
  return {
    version: '1.0.0',
    projectName: 'acme',
    wikiDir,
    focusDirs: [],
  };
}

describe('runUpgradeSteps', () => {
  it('rejects unsafe wikiDir values before overwriting project-root files', () => {
    const projectRoot = makeTmpDir();
    const readmePath = join(projectRoot, 'README.md');
    writeFileSync(readmePath, '# User README\n');

    expect(() => runUpgradeSteps(projectRoot, config('.'))).toThrow(/Unsafe wiki directory/);
    expect(readFileSync(readmePath, 'utf8')).toBe('# User README\n');
  });
});
