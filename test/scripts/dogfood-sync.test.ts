import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { PACKAGE_ROOT } from '../helpers/wiki.js';

const DOGFOOD_VARS: Record<string, string> = {
  WIKI_DIR: 'wiki',
  SCRIPTS_DIR: 'scripts/wiki',
};

function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function normalizeEol(str: string): string {
  return str.replace(/\r\n/g, '\n');
}

function listFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...listFiles(full));
    else results.push(full);
  }
  return results;
}

describe('dogfooded scripts/wiki matches templates/scripts', () => {
  it('every template script matches the interpolated dogfooded copy', () => {
    const templateDir = join(PACKAGE_ROOT, 'templates', 'scripts');
    const dogfoodDir = join(PACKAGE_ROOT, 'scripts', 'wiki');

    const templateFiles = listFiles(templateDir).filter((f) => f.endsWith('.mjs'));

    expect(templateFiles.length).toBeGreaterThan(0);

    for (const templateFile of templateFiles) {
      const rel = templateFile.slice(templateDir.length + 1);
      const dogfoodFile = join(dogfoodDir, rel);

      const expected = interpolate(readFileSync(templateFile, 'utf8'), DOGFOOD_VARS);
      const actual = readFileSync(dogfoodFile, 'utf8');

      expect(normalizeEol(actual), rel).toBe(normalizeEol(expected));
    }
  });
});
