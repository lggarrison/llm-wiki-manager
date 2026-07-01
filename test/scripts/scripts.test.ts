import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  WIKI_SCRIPT_KEYS,
  wikiScriptCandidates,
  mergePackageJsonScripts,
} from '../../src/utils/fs.js';
import { makeTmpWikiDir, cleanup } from '../helpers/wiki.js';
import { runBuiltCli } from '../helpers/cli.js';

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = makeTmpWikiDir();
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) cleanup(dir);
});

describe('wiki CLI script aliases', () => {
  it('wikiScriptCandidates returns llm-wiki-manager invocations', () => {
    const candidates = wikiScriptCandidates();
    expect(candidates['wiki:lint']).toBe('llm-wiki-manager lint');
    expect(candidates['wiki:check']).toBe('llm-wiki-manager check');
    expect(candidates['wiki:sync']).toBe('llm-wiki-manager sync');
  });

  it('mergePackageJsonScripts registers every wiki alias', () => {
    const projectDir = makeTmpDir();
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'acme' }, null, 2) + '\n',
    );

    const result = mergePackageJsonScripts(projectDir);
    expect(result.status).toBe('merged');
    expect(result.status === 'merged' ? result.added : []).toEqual([...WIKI_SCRIPT_KEYS]);

    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.scripts).filter((k: string) => k.startsWith('wiki:'))).toEqual([
      ...WIKI_SCRIPT_KEYS,
    ]);
    expect(pkg.scripts).toEqual(wikiScriptCandidates());
  });
});

describe('wiki CLI smoke tests', () => {
  it('help documents every npm alias with usage hints', () => {
    const result = runBuiltCli(process.cwd(), ['help']);
    expect(result.status).toBe(0);

    for (const key of WIKI_SCRIPT_KEYS) {
      expect(result.stdout).toContain(key);
      expect(result.stdout).toContain('When:');
      expect(result.stdout).toContain('Run:');
    }
  });
});
