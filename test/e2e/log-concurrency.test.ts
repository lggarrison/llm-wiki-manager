import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PACKAGE_ROOT } from '../helpers/wiki.js';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeWikiDirWithLog(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-log-concurrency-e2e-'));
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'log.md'), '# Log\n');
  return dir;
}

type CliResult = {
  code: number | null;
  stderr: string;
};

function runLogAsync(wikiDir: string, title: string): Promise<CliResult> {
  const cliPath = join(PACKAGE_ROOT, 'dist', 'bin', 'cli.js');
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cliPath, 'log', 'add', 'maintenance', title, '--wiki-dir', wikiDir],
      {
        cwd: wikiDir,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stderr }));
  });
}

describe('log command concurrency', () => {
  it('does not lose entries from concurrent CLI processes', async () => {
    const wikiDir = makeWikiDirWithLog();
    const titles = Array.from({ length: 40 }, (_, i) => `Concurrent entry ${i}`);

    const results = await Promise.all(titles.map((title) => runLogAsync(wikiDir, title)));

    expect(results).toEqual(titles.map(() => ({ code: 0, stderr: '' })));
    const log = readFileSync(join(wikiDir, 'log.md'), 'utf8');
    const lines = log.split(/\r?\n/);
    for (const title of titles) {
      expect(lines.filter((line) => line.endsWith(`maintenance | ${title}`))).toHaveLength(1);
    }
  }, 20_000);
});
