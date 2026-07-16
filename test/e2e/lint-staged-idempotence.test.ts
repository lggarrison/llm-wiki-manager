import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli } from '../helpers/cli.js';
import { PACKAGE_ROOT } from '../helpers/wiki.js';
import { formatLintStagedPackageJsonSnippet } from '../../src/wiki/lint-staged-snippet.js';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function run(cmd: string, cwd: string, args: string[] = []): ReturnType<typeof spawnSync> {
  const command = [cmd, ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ');
  return spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-lint-staged-e2e-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
  tmpDirs.push(dir);
  return dir;
}

function pinDevDependencyToPackedTarball(dir: string): void {
  const packDir = mkdtempSync(join(tmpdir(), 'llm-wiki-pack-'));
  tmpDirs.push(packDir);

  const pack = run('npm', PACKAGE_ROOT, [
    'pack',
    '--pack-destination',
    packDir,
    '--ignore-scripts',
  ]);
  expect(pack.status).toBe(0);

  const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
  expect(tarball).toBeTruthy();

  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    devDependencies: Record<string, string>;
  };
  pkg.devDependencies['llm-wiki-manager'] = `file:${join(packDir, tarball!)}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function configureLintStaged(dir: string): void {
  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    'lint-staged'?: Record<string, string[]>;
  };
  const snippet = JSON.parse(`{${formatLintStagedPackageJsonSnippet('wiki')}}`) as {
    'lint-staged': Record<string, string[]>;
  };
  pkg['lint-staged'] = snippet['lint-staged'];
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

describe('lint-staged idempotence e2e', () => {
  it('build output survives the documented pre-commit pipeline in a temp consumer project', () => {
    const dir = makeTmpProject();

    const init = runBuiltCli(dir, [
      'init',
      '--project-name',
      'acme',
      '--wiki-dir',
      'wiki',
      '--focus-dirs',
      'src',
    ]);
    expect(init.status).toBe(0);

    cpSync(join(PACKAGE_ROOT, '.prettierrc.json'), join(dir, '.prettierrc.json'));

    pinDevDependencyToPackedTarball(dir);

    const installPrettier = run('npm', dir, ['install', '-D', 'prettier']);
    expect(installPrettier.status).toBe(0);

    expect(run('git', dir, ['init']).status).toBe(0);
    run('git', dir, ['config', 'user.email', 'test@example.com']);
    run('git', dir, ['config', 'user.name', 'Test User']);
    expect(run('git', dir, ['add', '-A']).status).toBe(0);
    expect(run('git', dir, ['commit', '-m', 'init wiki']).status).toBe(0);

    const indexPath = join(dir, 'wiki', 'index.md');
    const committed = readFileSync(indexPath, 'utf8');

    const rebuild = runBuiltCli(dir, ['build', '--wiki-dir', 'wiki']);
    expect(rebuild.status).toBe(0);
    expect(readFileSync(indexPath, 'utf8')).toBe(committed);

    const lint = runBuiltCli(dir, ['lint', '--wiki-dir', 'wiki']);
    expect(lint.status).toBe(0);

    const prettier = run('npx', dir, ['prettier', '--write', 'wiki/index.md']);
    expect(prettier.status).toBe(0);
    expect(readFileSync(indexPath, 'utf8')).toBe(committed);

    const check = runBuiltCli(dir, ['check', '--wiki-dir', 'wiki']);
    expect(check.status).toBe(0);

    const secondBuild = runBuiltCli(dir, ['build', '--wiki-dir', 'wiki']);
    expect(secondBuild.status).toBe(0);
    expect(readFileSync(indexPath, 'utf8')).toBe(committed);
  }, 60_000);

  it('stages regenerated index.md when lint-staged runs for a new wiki page', () => {
    const dir = makeTmpProject();

    const init = runBuiltCli(dir, [
      'init',
      '--project-name',
      'acme',
      '--wiki-dir',
      'wiki',
      '--focus-dirs',
      'src',
    ]);
    expect(init.status).toBe(0);

    writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    cpSync(join(PACKAGE_ROOT, '.prettierrc.json'), join(dir, '.prettierrc.json'));

    pinDevDependencyToPackedTarball(dir);
    configureLintStaged(dir);

    const installHookDeps = run('npm', dir, ['install', '-D', 'lint-staged', 'prettier']);
    expect(installHookDeps.status).toBe(0);

    expect(run('git', dir, ['init']).status).toBe(0);
    run('git', dir, ['config', 'user.email', 'test@example.com']);
    run('git', dir, ['config', 'user.name', 'Test User']);
    expect(run('git', dir, ['add', '-A']).status).toBe(0);
    expect(run('git', dir, ['commit', '-m', 'init wiki']).status).toBe(0);

    writeFileSync(
      join(dir, 'wiki', 'concepts', 'new-runtime-page.md'),
      [
        '---',
        'type: concept',
        'title: New Runtime Page',
        'last_updated: 2026-07-16T00:00:00Z',
        'tags: []',
        'related: []',
        'status: active',
        '---',
        '',
        'Runtime body.',
        '',
      ].join('\n'),
    );
    expect(run('git', dir, ['add', 'wiki/concepts/new-runtime-page.md']).status).toBe(0);

    const lintStaged = run('npx', dir, ['lint-staged']);
    expect(lintStaged.status).toBe(0);

    const stagedNames = run('git', dir, ['diff', '--cached', '--name-only']);
    expect(stagedNames.status).toBe(0);
    expect(stagedNames.stdout.trim().split('\n').sort()).toEqual([
      'wiki/concepts/new-runtime-page.md',
      'wiki/index.md',
    ]);

    const unstagedNames = run('git', dir, ['diff', '--name-only']);
    expect(unstagedNames.status).toBe(0);
    expect(unstagedNames.stdout.trim()).toBe('');

    const stagedTree = mkdtempSync(join(tmpdir(), 'llm-wiki-staged-tree-'));
    tmpDirs.push(stagedTree);
    const checkoutStaged = run('git', dir, ['checkout-index', '-a', `--prefix=${stagedTree}/`]);
    expect(checkoutStaged.status).toBe(0);

    const stagedInstall = run('npm', stagedTree, ['install']);
    expect(stagedInstall.status).toBe(0);

    const stagedCheck = run('npm', stagedTree, ['run', 'wiki:check']);
    expect(stagedCheck.status).toBe(0);
    expect(stagedCheck.stdout).toContain('index.md is up to date');
  }, 60_000);
});
