import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli } from '../helpers/cli.js';
import { fm, writePage } from '../helpers/wiki.js';
import { packageBinPath } from '../../src/utils/fs.js';

const tmpDirs: string[] = [];

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-doctor-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
  tmpDirs.push(dir);
  return dir;
}

function stubInstalledCli(dir: string): void {
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(packageBinPath(dir), '');
}

function initProject(dir: string): ReturnType<typeof runBuiltCli> {
  return runBuiltCli(dir, ['init', '--project-name', 'acme', '--wiki-dir', 'wiki']);
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('doctor command', () => {
  it('reports no problems on a fresh init', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);
    stubInstalledCli(dir);

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No problems found');
  });

  it('reports a missing local install when wiki scripts exist', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('llm-wiki-manager is not installed locally');
    expect(result.stdout).toContain('npm install');
  });

  it('fails and suggests init when nothing is scaffolded', () => {
    const dir = makeTmpProject();
    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('run npx llm-wiki-manager init');
  });

  it('suggests upgrade when the scaffold version is behind the package', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);
    stubInstalledCli(dir);

    const configPath = join(dir, '.llm-wiki-manager.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { version: string };
    config.version = '0.0.1';
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('scaffold is v0.0.1');
    expect(result.stdout).toContain('upgrade');
  });

  it('reports a stale index.md', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    writePage(
      join(dir, 'wiki'),
      'concepts/new-page.md',
      fm({ type: 'concept', title: 'New Page' }) + '\nBody.\n',
    );

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('index.md is stale');
  });

  it('reports outdated package.json wiki scripts', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      scripts: Record<string, string>;
    };
    pkg.scripts['wiki:lint'] = 'node scripts/wiki/lint.mjs';
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('wiki:lint');
  });

  it('reports a missing managed section in AGENTS.md', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    writeFileSync(join(dir, 'AGENTS.md'), '# Project notes only\n\nNo managed block.\n');

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('managed section');
    expect(result.stdout).toContain('upgrade');
  });

  it('accepts .llm-wiki-manager.json written with a UTF-8 BOM', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);
    stubInstalledCli(dir);

    const configPath = join(dir, '.llm-wiki-manager.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(
      configPath,
      String.fromCharCode(0xfeff) + JSON.stringify(config, null, 2) + '\n',
      'utf8',
    );

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No problems found');
  });

  it('accepts index.md checked out with CRLF line endings', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    writePage(
      join(dir, 'wiki'),
      'concepts/new-page.md',
      fm({ type: 'concept', title: 'New Page' }) + '\nBody.\n',
    );
    expect(runBuiltCli(dir, ['build', '--wiki-dir', 'wiki']).status).toBe(0);

    const indexPath = join(dir, 'wiki', 'index.md');
    const lf = readFileSync(indexPath, 'utf8');
    writeFileSync(indexPath, lf.replace(/\n/g, '\r\n'), 'utf8');
    stubInstalledCli(dir);

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('index.md is up to date');
  });
});
