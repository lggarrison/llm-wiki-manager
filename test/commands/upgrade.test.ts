import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildTemplateVars,
  scaffoldWikiTemplates,
  replaceManagedSection,
  interpolate,
  templatePath,
} from '../../src/utils/fs.js';
import { runUpgradeSteps, runPostUpgradeScripts } from '../../src/utils/upgrade.js';
import { fm, writePage } from '../helpers/wiki.js';
import { runBuiltCli } from '../helpers/cli.js';

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
    writeFileSync(
      agentsPath,
      '# Project\n\n<!-- llm-wiki-manager -->\n# Old\n\nStale pointer.\n<!-- /llm-wiki-manager -->\n',
    );

    const content = interpolate(readFileSync(templatePath('AGENTS.md'), 'utf8'), {
      PROJECT_NAME: 'acme',
      WIKI_DIR: 'wiki',
    });
    replaceManagedSection(agentsPath, content);

    const updated = readFileSync(agentsPath, 'utf8');
    expect(updated).toContain('# Project');
    expect(updated).toContain('[`wiki/AGENTS.md`](wiki/AGENTS.md)');
    expect(updated).not.toContain('Stale pointer.');
  });

  it('runUpgradeSteps overwrites wiki meta templates', () => {
    const dir = makeTmpDir();
    const wikiDir = join(dir, 'wiki');
    mkdirSync(wikiDir, { recursive: true });

    writeFileSync(join(wikiDir, 'schema.md'), '# old schema\n');

    const config = {
      version: '0.0.0',
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: ['src'],
    };

    runUpgradeSteps(dir, config);

    expect(readFileSync(join(wikiDir, 'schema.md'), 'utf8')).toContain('Wiki Schema — acme');
  });

  it('rejects incomplete install config before writing templates', () => {
    const dir = makeTmpDir();
    const wikiDir = join(dir, 'wiki');
    mkdirSync(wikiDir, { recursive: true });
    writeFileSync(join(wikiDir, 'schema.md'), '# original schema\n');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({ version: '1.0.0', wikiDir: 'wiki', focusDirs: [] }, null, 2) + '\n',
    );

    const result = runBuiltCli(dir, ['upgrade']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.llm-wiki-manager.json is invalid');
    expect(result.stderr).toContain('projectName');
    expect(readFileSync(join(wikiDir, 'schema.md'), 'utf8')).toBe('# original schema\n');
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });
});

describe('init safe re-run via scaffoldWikiTemplates', () => {
  it('preserves user concept pages and log.md', () => {
    const wikiDir = makeTmpDir();
    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
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

describe('migrate-pages via upgrade', () => {
  it('remaps legacy status values', async () => {
    const dir = makeTmpDir();
    const wikiDir = join(dir, 'wiki');
    mkdirSync(wikiDir, { recursive: true });
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({
        version: '0.0.0',
        projectName: 'acme',
        wikiDir: 'wiki',
        focusDirs: [],
      }) + '\n',
    );
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');

    writePage(
      wikiDir,
      'concepts/legacy.md',
      fm({ status: 'draft', title: 'Legacy', type: 'concept' }) +
        '\n# Legacy\n\nSee also [Status Migration](status-migration.md).\n',
    );
    writePage(
      wikiDir,
      'concepts/status-migration.md',
      fm({ title: 'Status Migration', type: 'concept' }) +
        '\n# Status Migration\n\nCovers [legacy status values](legacy.md).\n',
    );

    await runPostUpgradeScripts(dir, {
      version: '0.0.0',
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: [],
    });

    const content = readFileSync(join(wikiDir, 'concepts', 'legacy.md'), 'utf8');
    expect(content).toContain('status: wip');
    expect(content).not.toContain('status: draft');
  });
});
