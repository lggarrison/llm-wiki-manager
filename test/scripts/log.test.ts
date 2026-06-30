import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { makeTmpWikiDir, cleanup, scriptPath } from '../helpers/wiki.js';

const dirs: string[] = [];
function newWikiDirWithLog(): string {
  const dir = makeTmpWikiDir();
  dirs.push(dir);
  writeFileSync(join(dir, 'log.md'), '# Log\n');
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) cleanup(dir);
});

function runLog(wikiDir: string, args: string[]) {
  return spawnSync('node', [scriptPath('log.mjs'), ...args, '--wiki-dir', wikiDir], {
    encoding: 'utf8',
  });
}

describe('log.mjs', () => {
  it("appends an entry with today's date by default", () => {
    const dir = newWikiDirWithLog();
    const result = runLog(dir, ['add', 'ingest', 'Test Source']);
    expect(result.status).toBe(0);
    const log = readFileSync(join(dir, 'log.md'), 'utf8');
    const today = new Date().toISOString().slice(0, 10);
    expect(log).toContain(`## [${today}] ingest | Test Source`);
  });

  it('honors an explicit --date flag', () => {
    const dir = newWikiDirWithLog();
    const result = runLog(dir, ['add', 'query', 'Old question', '--date=2025-01-15']);
    expect(result.status).toBe(0);
    const log = readFileSync(join(dir, 'log.md'), 'utf8');
    expect(log).toContain('## [2025-01-15] query | Old question');
  });

  it('accepts all valid operations', () => {
    const dir = newWikiDirWithLog();
    for (const op of ['ingest', 'query', 'lint', 'maintenance']) {
      const result = runLog(dir, ['add', op, `${op} title`]);
      expect(result.status).toBe(0);
    }
    const log = readFileSync(join(dir, 'log.md'), 'utf8');
    expect(log).toContain('ingest | ingest title');
    expect(log).toContain('maintenance | maintenance title');
  });

  it('rejects an unknown operation', () => {
    const dir = newWikiDirWithLog();
    const result = runLog(dir, ['add', 'bogus', 'Title']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown operation');
  });

  it('rejects a malformed --date value', () => {
    const dir = newWikiDirWithLog();
    const result = runLog(dir, ['add', 'ingest', 'Title', '--date=not-a-date']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid date');
  });

  it('requires a title', () => {
    const dir = newWikiDirWithLog();
    const result = runLog(dir, ['add', 'ingest']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Title is required');
  });

  it('fails when log.md does not exist', () => {
    const dir = makeTmpWikiDir();
    dirs.push(dir);
    const result = runLog(dir, ['add', 'ingest', 'Title']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('log.md not found');
  });

  it('appends without clobbering existing entries', () => {
    const dir = newWikiDirWithLog();
    runLog(dir, ['add', 'ingest', 'First']);
    runLog(dir, ['add', 'query', 'Second']);
    const log = readFileSync(join(dir, 'log.md'), 'utf8');
    expect(log).toContain('First');
    expect(log).toContain('Second');
    expect(log.indexOf('First')).toBeLessThan(log.indexOf('Second'));
  });
});
