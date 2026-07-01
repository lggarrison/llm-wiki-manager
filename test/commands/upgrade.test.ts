import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import {
  buildTemplateVars,
  scaffoldWikiTemplates,
  replaceManagedSection,
  interpolate,
  templatePath,
  upgradeScripts,
} from '../../src/utils/fs.js';
import { runUpgradeSteps } from '../../src/utils/upgrade.js';
import { fm, writePage } from '../helpers/wiki.js';

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-upgrade-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  const { rmSync } = await import('fs');
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('upgrade helpers', () => {
  it('refreshes root AGENTS.md managed section', () => {
    const dir = makeTmpDir();
    const agentsPath = join(dir, 'AGENTS.md');
    writeFileSync(agentsPath, '# Project\n\n<!-- llm-wiki-manager -->\n# Old\n\nStale pointer.\n');

    const content = interpolate(readFileSync(templatePath('AGENTS.md'), 'utf8'), {
      PROJECT_NAME: 'acme',
      WIKI_DIR: 'wiki',
      SCRIPTS_DIR: 'scripts/wiki',
    });
    replaceManagedSection(agentsPath, content);

    const updated = readFileSync(agentsPath, 'utf8');
    expect(updated).toContain('# Project');
    expect(updated).toContain('[`wiki/AGENTS.md`](wiki/AGENTS.md)');
    expect(updated).not.toContain('Stale pointer.');
  });

  it('runUpgradeSteps overwrites scripts and wiki meta', () => {
    const dir = makeTmpDir();
    const wikiDir = join(dir, 'wiki');
    const scriptsDir = join(dir, 'scripts', 'wiki');
    mkdirSync(wikiDir, { recursive: true });
    mkdirSync(scriptsDir, { recursive: true });

    writeFileSync(join(wikiDir, 'schema.md'), '# old schema\n');
    writeFileSync(join(scriptsDir, 'lint.mjs'), '// old\n');

    const config = {
      version: '0.0.0',
      projectName: 'acme',
      wikiDir: 'wiki',
      scriptsDir: 'scripts/wiki',
      focusDirs: ['src'],
    };

    runUpgradeSteps(dir, config);

    expect(readFileSync(join(wikiDir, 'schema.md'), 'utf8')).toContain('Wiki Schema — acme');
    expect(readFileSync(join(scriptsDir, 'lint.mjs'), 'utf8')).toContain('lint.mjs');
    expect(existsSync(join(scriptsDir, 'migrate-pages.mjs'))).toBe(true);
  });
});

describe('init safe re-run via scaffoldWikiTemplates', () => {
  it('preserves user concept pages and log.md', () => {
    const wikiDir = makeTmpDir();
    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      scriptsDir: 'scripts/wiki',
      focusDirs: [],
      initTimestamp: '2026-06-30T00:00:00Z',
    });

    scaffoldWikiTemplates(wikiDir, vars, { overwrite: false });
    writeFileSync(join(wikiDir, 'log.md'), '# preserved log\n');
    mkdirSync(join(wikiDir, 'concepts'), { recursive: true });
    writeFileSync(join(wikiDir, 'concepts', 'mine.md'), '# my concept\n');

    scaffoldWikiTemplates(wikiDir, vars, { overwrite: false });

    expect(readFileSync(join(wikiDir, 'log.md'), 'utf8')).toBe('# preserved log\n');
    expect(readFileSync(join(wikiDir, 'concepts', 'mine.md'), 'utf8')).toBe('# my concept\n');
  });
});

describe('migrate-pages.mjs', () => {
  it('remaps legacy status values', () => {
    const wikiDir = makeTmpDir();
    const scriptsDir = join(wikiDir, 'scripts', 'wiki');
    mkdirSync(scriptsDir, { recursive: true });

    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: '.',
      scriptsDir: 'scripts/wiki',
      focusDirs: [],
    });
    upgradeScripts(scriptsDir, vars);

    writePage(
      wikiDir,
      'concepts/legacy.md',
      fm({ status: 'draft', title: 'Legacy', type: 'concept' }) + '\n# Legacy\n',
    );

    const script = join(scriptsDir, 'migrate-pages.mjs');
    const result = spawnSync(process.execPath, [script, '--wiki-dir', wikiDir], {
      cwd: wikiDir,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);

    const content = readFileSync(join(wikiDir, 'concepts', 'legacy.md'), 'utf8');
    expect(content).toContain('status: wip');
    expect(content).not.toContain('status: draft');
  });
});
