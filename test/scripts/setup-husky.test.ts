import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scriptPath } from '../helpers/wiki.js';

const tmpDirs: string[] = [];

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-husky-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function installFakeHusky(projectDir: string): void {
  const huskyDir = join(projectDir, 'node_modules', 'husky');
  mkdirSync(huskyDir, { recursive: true });
  writeFileSync(
    join(huskyDir, 'package.json'),
    JSON.stringify({ type: 'module', exports: { '.': './index.js' } }),
  );
  writeFileSync(join(huskyDir, 'index.js'), 'export default function husky() {}\n');
}

function installSetupScript(projectDir: string): string {
  const dest = join(projectDir, 'setup-husky.mjs');
  cpSync(scriptPath('setup-husky.mjs'), dest);
  return dest;
}

function runSetupHusky(projectDir: string): ReturnType<typeof spawnSync> {
  const script = installSetupScript(projectDir);
  return spawnSync('node', [script], { cwd: projectDir, encoding: 'utf8' });
}

function initGitRepo(projectDir: string): void {
  mkdirSync(join(projectDir, '.git'), { recursive: true });
}

describe('setup-husky.mjs', () => {
  it('exits 1 when .git is missing', () => {
    const projectDir = makeProjectDir();
    installFakeHusky(projectDir);

    const result = runSetupHusky(projectDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not a git repository');
  });

  it('exits 1 when husky is not installed', () => {
    const projectDir = makeProjectDir();
    initGitRepo(projectDir);

    const result = runSetupHusky(projectDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('husky is not installed');
  });

  it('creates pre-commit and pre-push when .husky does not exist', () => {
    const projectDir = makeProjectDir();
    initGitRepo(projectDir);
    installFakeHusky(projectDir);

    const result = runSetupHusky(projectDir);
    expect(result.status).toBe(0);

    expect(readFileSync(join(projectDir, '.husky', 'pre-commit'), 'utf8')).toBe(
      'npm run wiki:lint\n',
    );
    expect(readFileSync(join(projectDir, '.husky', 'pre-push'), 'utf8')).toBe(
      'npm run wiki:check\n',
    );
    expect(result.stdout).toContain('pre-commit: created');
    expect(result.stdout).toContain('pre-push: created');
  });

  it('appends to existing hooks without removing other commands', () => {
    const projectDir = makeProjectDir();
    initGitRepo(projectDir);
    installFakeHusky(projectDir);
    mkdirSync(join(projectDir, '.husky'), { recursive: true });
    writeFileSync(join(projectDir, '.husky', 'pre-commit'), 'npx lint-staged\n');

    const result = runSetupHusky(projectDir);
    expect(result.status).toBe(0);

    const preCommit = readFileSync(join(projectDir, '.husky', 'pre-commit'), 'utf8');
    expect(preCommit).toContain('npx lint-staged');
    expect(preCommit).toContain('# llm-wiki-manager');
    expect(preCommit).toContain('npm run wiki:lint');
    expect(result.stdout).toContain('pre-commit: appended to');
  });

  it('is idempotent on re-run', () => {
    const projectDir = makeProjectDir();
    initGitRepo(projectDir);
    installFakeHusky(projectDir);

    expect(runSetupHusky(projectDir).status).toBe(0);
    const afterFirst = readFileSync(join(projectDir, '.husky', 'pre-commit'), 'utf8');

    const second = runSetupHusky(projectDir);
    expect(second.status).toBe(0);
    expect(readFileSync(join(projectDir, '.husky', 'pre-commit'), 'utf8')).toBe(afterFirst);
    expect(second.stdout).toContain('already configured');
  });

  it('creates only the missing hook when one already exists', () => {
    const projectDir = makeProjectDir();
    initGitRepo(projectDir);
    installFakeHusky(projectDir);
    mkdirSync(join(projectDir, '.husky'), { recursive: true });
    writeFileSync(
      join(projectDir, '.husky', 'pre-commit'),
      '# llm-wiki-manager\nnpm run wiki:lint\n',
    );

    const result = runSetupHusky(projectDir);
    expect(result.status).toBe(0);
    expect(existsSync(join(projectDir, '.husky', 'pre-push'))).toBe(true);
    expect(result.stdout).toContain('pre-commit: already configured');
    expect(result.stdout).toContain('pre-push: created');
  });
});
