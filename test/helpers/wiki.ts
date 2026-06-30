import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
    last_updated: '2026-01-01',
    tags: [],
    related: [],
    status: 'draft',
  };
  const merged = { ...defaults, ...fields };
  const lines = Object.entries(merged).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n`;
}

export function scriptPath(name: string): string {
  return join(PACKAGE_ROOT, 'templates', 'scripts', name);
}
