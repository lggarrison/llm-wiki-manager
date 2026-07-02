import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli } from '../helpers/cli.js';
import { PACKAGE_ROOT } from '../helpers/wiki.js';

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
});
