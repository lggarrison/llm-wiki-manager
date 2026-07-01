import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli, runNodeScript } from '../helpers/cli.js';
import { fm, writePage, PACKAGE_ROOT } from '../helpers/wiki.js';

const tmpDirs: string[] = [];

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-e2e-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
  tmpDirs.push(dir);
  return dir;
}

function initProject(dir: string, extraArgs: string[] = []): ReturnType<typeof runBuiltCli> {
  return runBuiltCli(dir, [
    'init',
    '--project-name',
    'acme',
    '--wiki-dir',
    'wiki',
    '--scripts-dir',
    'scripts/wiki',
    ...extraArgs,
  ]);
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CLI e2e workflow', () => {
  it('init scaffolds wiki, scripts, AGENTS.md, and install config', () => {
    const dir = makeTmpProject();
    const result = initProject(dir);

    expect(result.status).toBe(0);

    expect(existsSync(join(dir, 'wiki', 'schema.md'))).toBe(true);
    expect(existsSync(join(dir, 'wiki', 'index.md'))).toBe(true);
    expect(existsSync(join(dir, 'scripts', 'wiki', 'lint.mjs'))).toBe(true);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(dir, '.llm-wiki-manager.json'))).toBe(true);

    const schema = readFileSync(join(dir, 'wiki', 'schema.md'), 'utf8');
    expect(schema).toContain('Wiki Schema — acme');

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['wiki:lint']).toContain('scripts/wiki/lint.mjs');
    expect(pkg.scripts['wiki:check']).toContain('--check');
  });

  it('wiki scripts lint, build, and check after init', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    writePage(
      join(dir, 'wiki'),
      'concepts/hello.md',
      fm({ type: 'concept', title: 'Hello' }) + '\nIntro body.\n',
    );

    const lint = runNodeScript(dir, join(dir, 'scripts', 'wiki', 'lint.mjs'), [
      '--wiki-dir',
      'wiki',
    ]);
    expect(lint.status).toBe(0);

    const build = runNodeScript(dir, join(dir, 'scripts', 'wiki', 'build-index.mjs'), [
      '--wiki-dir',
      'wiki',
    ]);
    expect(build.status).toBe(0);
    expect(readFileSync(join(dir, 'wiki', 'index.md'), 'utf8')).toContain('Hello');

    const check = runNodeScript(dir, join(dir, 'scripts', 'wiki', 'build-index.mjs'), [
      '--wiki-dir',
      'wiki',
      '--check',
    ]);
    expect(check.status).toBe(0);
  });

  it('upgrade refreshes templates and preserves user pages', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const userPage = join(dir, 'wiki', 'concepts', 'user-owned.md');
    writePage(
      join(dir, 'wiki'),
      'concepts/user-owned.md',
      fm({ type: 'concept', title: 'User Owned' }) + '\n# User content\n',
    );
    const userContentBefore = readFileSync(userPage, 'utf8');

    writeFileSync(join(dir, 'wiki', 'schema.md'), '# stale schema\n');
    rmSync(join(dir, 'scripts', 'wiki', 'migrate-pages.mjs'));

    const upgrade = runBuiltCli(dir, ['upgrade']);
    expect(upgrade.status).toBe(0);

    expect(existsSync(join(dir, 'scripts', 'wiki', 'migrate-pages.mjs'))).toBe(true);
    expect(readFileSync(join(dir, 'wiki', 'schema.md'), 'utf8')).toContain('Wiki Schema — acme');
    expect(readFileSync(userPage, 'utf8')).toBe(userContentBefore);
  });

  it('upgrade migrates legacy status values on pages', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    writePage(
      join(dir, 'wiki'),
      'concepts/legacy.md',
      fm({ status: 'draft', title: 'Legacy', type: 'concept' }) + '\n# Legacy\n',
    );

    const upgrade = runBuiltCli(dir, ['upgrade']);
    expect(upgrade.status).toBe(0);

    const content = readFileSync(join(dir, 'wiki', 'concepts', 'legacy.md'), 'utf8');
    expect(content).toContain('status: wip');
    expect(content).not.toContain('status: draft');
  });
});

describe('CLI meta flags', () => {
  const packageVersion = (
    JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }
  ).version;

  it('--version prints the package version and exits 0', () => {
    const dir = makeTmpProject();
    const result = runBuiltCli(dir, ['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
  });

  it('--help prints usage listing both commands and exits 0', () => {
    const dir = makeTmpProject();
    const result = runBuiltCli(dir, ['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: llm-wiki-manager');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('upgrade');
  });

  it('an unknown command exits 1 with usage on stderr', () => {
    const dir = makeTmpProject();
    const result = runBuiltCli(dir, ['bogus']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command: bogus');
    expect(result.stderr).toContain('Usage: llm-wiki-manager');
  });
});
