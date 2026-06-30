import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  WIKI_SCRIPT_KEYS,
  WIKI_TEMPLATE_SCRIPTS,
  wikiScriptCandidates,
  copyTemplate,
  mergePackageJsonScripts,
  templatePath,
} from '../../src/utils/fs.js';
import { makeTmpWikiDir, cleanup, writePage, fm, scriptPath } from '../helpers/wiki.js';

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = makeTmpWikiDir();
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) cleanup(dir);
});

function scriptFileFromCommand(command: string): string {
  const match = command.match(/^node (.+\.mjs)/);
  if (!match) throw new Error(`unexpected command format: ${command}`);
  return match[1].split('/').pop()!;
}

function runScript(scriptFile: string, args: string[] = []): ReturnType<typeof spawnSync> {
  return spawnSync('node', [scriptPath(scriptFile), ...args], { encoding: 'utf8' });
}

describe('wiki script templates', () => {
  it('ships every expected script under templates/scripts', () => {
    const dir = templatePath('scripts');
    const onDisk = readdirSync(dir)
      .filter((f) => f.endsWith('.mjs'))
      .sort();
    expect(onDisk).toEqual([...WIKI_TEMPLATE_SCRIPTS].sort());
  });

  it('each template script is a runnable node entry point', () => {
    for (const script of WIKI_TEMPLATE_SCRIPTS) {
      const content = readFileSync(scriptPath(script), 'utf8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    }
  });

  it('each npm alias points at an existing template script file', () => {
    const candidates = wikiScriptCandidates('scripts/wiki');
    for (const key of WIKI_SCRIPT_KEYS) {
      const scriptFile = scriptFileFromCommand(candidates[key]);
      expect(existsSync(scriptPath(scriptFile))).toBe(true);
    }
  });

  it('copyTemplate scaffolds all scripts with interpolated placeholders', () => {
    const dest = makeTmpDir();
    copyTemplate(templatePath('scripts'), dest, {
      WIKI_DIR: 'docs/wiki',
      SCRIPTS_DIR: 'tools/wiki',
    });

    for (const script of WIKI_TEMPLATE_SCRIPTS) {
      expect(existsSync(join(dest, script))).toBe(true);
    }

    const lint = readFileSync(join(dest, 'lint.mjs'), 'utf8');
    expect(lint).toContain("'docs/wiki'");
    expect(lint).not.toContain('{{WIKI_DIR}}');
  });

  it('mergePackageJsonScripts registers every wiki alias', () => {
    const projectDir = makeTmpDir();
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'acme' }, null, 2) + '\n',
    );

    const result = mergePackageJsonScripts(projectDir, 'custom/scripts');
    expect(result.status).toBe('merged');
    expect(result.status === 'merged' ? result.added : []).toEqual([...WIKI_SCRIPT_KEYS]);

    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.scripts).filter((k: string) => k.startsWith('wiki:'))).toEqual([
      ...WIKI_SCRIPT_KEYS,
    ]);
    expect(pkg.scripts).toEqual(wikiScriptCandidates('custom/scripts'));
  });
});

describe('wiki script smoke tests', () => {
  it('help.mjs documents every npm alias with usage hints', () => {
    const result = runScript('help.mjs');
    expect(result.status).toBe(0);

    for (const key of WIKI_SCRIPT_KEYS) {
      expect(result.stdout).toContain(key);
      expect(result.stdout).toContain('When:');
      expect(result.stdout).toContain('Run:');
    }
  });

  it('lint.mjs validates an empty wiki', () => {
    const wikiDir = makeTmpDir();
    writeFileSync(join(wikiDir, 'index.md'), '# Wiki Index\n');
    writeFileSync(join(wikiDir, 'log.md'), '# Log\n');

    const result = runScript('lint.mjs', ['--wiki-dir', wikiDir]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No errors found');
  });

  it('build-index.mjs writes index.md', () => {
    const wikiDir = makeTmpDir();
    writePage(wikiDir, 'concepts/a.md', fm({ type: 'concept', title: 'Alpha' }));

    const result = runScript('build-index.mjs', ['--wiki-dir', wikiDir]);
    expect(result.status).toBe(0);
    expect(readFileSync(join(wikiDir, 'index.md'), 'utf8')).toContain('[Alpha](concepts/a.md)');
  });

  it('build-index.mjs --check passes on a fresh index and fails when stale', () => {
    const wikiDir = makeTmpDir();
    writePage(wikiDir, 'concepts/a.md', fm({ type: 'concept', title: 'Alpha' }));

    expect(runScript('build-index.mjs', ['--wiki-dir', wikiDir, '--check']).status).toBe(1);

    runScript('build-index.mjs', ['--wiki-dir', wikiDir]);
    expect(runScript('build-index.mjs', ['--wiki-dir', wikiDir, '--check']).status).toBe(0);

    writeFileSync(join(wikiDir, 'index.md'), '# stale\n');
    expect(runScript('build-index.mjs', ['--wiki-dir', wikiDir, '--check']).status).toBe(1);
  });

  it('sync-see-also.mjs exits cleanly on an empty wiki', () => {
    const wikiDir = makeTmpDir();
    const result = runScript('sync-see-also.mjs', ['--wiki-dir', wikiDir]);
    expect(result.status).toBe(0);
  });

  it('log.mjs appends an ingest entry', () => {
    const wikiDir = makeTmpDir();
    writeFileSync(join(wikiDir, 'log.md'), '# Log\n\n| Date | Op | Title |\n| --- | --- | --- |\n');

    const result = runScript('log.mjs', ['add', 'ingest', 'Test Source', '--wiki-dir', wikiDir]);
    expect(result.status).toBe(0);
    expect(readFileSync(join(wikiDir, 'log.md'), 'utf8')).toContain('Test Source');
  });

  it('log.mjs rejects unknown operations', () => {
    const wikiDir = makeTmpDir();
    writeFileSync(join(wikiDir, 'log.md'), '# Log\n');

    const result = runScript('log.mjs', ['add', 'bogus', 'Title', '--wiki-dir', wikiDir]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown operation');
  });
});
