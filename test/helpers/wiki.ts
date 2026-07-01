import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli } from './cli.js';
import { PACKAGE_ROOT } from './paths.js';

export { PACKAGE_ROOT };

export function makeTmpWikiDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-test-'));
  for (const sub of ['concepts', 'sources', 'entities', 'raw/articles']) {
    mkdirSync(join(dir, sub), { recursive: true });
  }
  return dir;
}

export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function writePage(wikiDir: string, rel: string, content: string): string {
  const full = join(wikiDir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

export function fm(fields: Record<string, string | string[]> = {}): string {
  const defaults: Record<string, string | string[]> = {
    type: 'concept',
    title: 'Test Page',
    last_updated: '2026-01-01T00:00:00Z',
    tags: [],
    related: [],
    status: 'wip',
  };
  const merged = { ...defaults, ...fields };
  const lines = Object.entries(merged).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n`;
}

export function runWikiCli(
  cwd: string,
  command: string,
  args: string[] = [],
): ReturnType<typeof runBuiltCli> {
  return runBuiltCli(cwd, [command, '--wiki-dir', cwd, ...args]);
}

export function runWikiCliWithWikiDir(
  wikiDir: string,
  command: string,
  args: string[] = [],
): ReturnType<typeof runBuiltCli> {
  return runBuiltCli(wikiDir, [command, '--wiki-dir', wikiDir, ...args]);
}
