import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fm, writePage, PACKAGE_ROOT } from '../helpers/wiki.js';
import { runBuiltCli } from '../helpers/cli.js';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function run(cmd: string, cwd: string, args: string[] = []): ReturnType<typeof spawnSync> {
  // Single command string: passing an args array with shell:true is deprecated (DEP0190)
  const command = [cmd, ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ');
  return spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

describe('packed tarball smoke test', () => {
  it('lint, build, check, and sync work from an npm-packed install', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'llm-wiki-pack-'));
    tmpDirs.push(packDir);

    const pack = run('npm', PACKAGE_ROOT, ['pack', '--pack-destination', packDir]);
    expect(pack.status).toBe(0);

    const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
    expect(tarball).toBeTruthy();

    const projectDir = mkdtempSync(join(tmpdir(), 'llm-wiki-packed-consumer-'));
    tmpDirs.push(projectDir);
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'acme' }, null, 2) + '\n',
    );

    const install = run('npm', projectDir, ['install', join(packDir, tarball!)]);
    expect(install.status).toBe(0);

    const bin = join(projectDir, 'node_modules', '.bin', 'llm-wiki-manager');
    expect(existsSync(bin) || existsSync(`${bin}.cmd`)).toBe(true);

    const init = run('npx', projectDir, [
      'llm-wiki-manager',
      'init',
      '--project-name',
      'acme',
      '--wiki-dir',
      'wiki',
    ]);
    expect(init.status).toBe(0);

    const checkAfterInit = run('npx', projectDir, ['llm-wiki-manager', 'check']);
    expect(checkAfterInit.status).toBe(0);
    expect(checkAfterInit.stdout).toContain('up to date');

    const doctor = run('npx', projectDir, ['llm-wiki-manager', 'doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain('No problems found');

    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['wiki:lint']).toBe('llm-wiki-manager lint');

    writePage(
      join(projectDir, 'wiki'),
      'concepts/drawing.md',
      fm({ type: 'concept', title: 'Drawing', related: ['concepts/smoke.md'] }) + '\nBody.\n',
    );
    writePage(
      join(projectDir, 'wiki'),
      'concepts/smoke.md',
      fm({ type: 'concept', title: 'Smoke' }) + '\nBody.\n',
    );

    const lint = run('npx', projectDir, ['llm-wiki-manager', 'lint']);
    expect(lint.status).toBe(0);

    const build = run('npx', projectDir, ['llm-wiki-manager', 'build']);
    expect(build.status).toBe(0);
    expect(readFileSync(join(projectDir, 'wiki', 'index.md'), 'utf8')).toContain('Smoke');

    const check = run('npx', projectDir, ['llm-wiki-manager', 'check']);
    expect(check.status).toBe(0);

    const sync = run('npx', projectDir, ['llm-wiki-manager', 'sync']);
    expect(sync.status).toBe(0);
  });

  it('npm run wiki:lint works after npx-style init followed by npm install', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'llm-wiki-pack-npx-'));
    tmpDirs.push(packDir);

    const pack = run('npm', PACKAGE_ROOT, ['pack', '--pack-destination', packDir]);
    expect(pack.status).toBe(0);

    const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
    expect(tarball).toBeTruthy();

    const projectDir = mkdtempSync(join(tmpdir(), 'llm-wiki-npx-consumer-'));
    tmpDirs.push(projectDir);
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'acme' }, null, 2) + '\n',
    );

    const init = runBuiltCli(projectDir, ['init', '--project-name', 'acme', '--wiki-dir', 'wiki']);
    expect(init.status).toBe(0);

    const pkgBeforeInstall = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkgBeforeInstall.scripts['wiki:lint']).toBe('llm-wiki-manager lint');
    expect(pkgBeforeInstall.devDependencies?.['llm-wiki-manager']).toMatch(/^\^/);

    const install = run('npm', projectDir, ['install', join(packDir, tarball!)]);
    expect(install.status).toBe(0);

    const npmLint = run('npm', projectDir, ['run', 'wiki:lint']);
    expect(npmLint.status).toBe(0);
  });
});
