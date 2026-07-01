import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli } from '../helpers/cli.js';
import { fm, writePage } from '../helpers/wiki.js';

const tmpDirs: string[] = [];

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-doctor-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
  tmpDirs.push(dir);
  return dir;
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

    const result = runBuiltCli(dir, ['doctor']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No problems found');
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
});
