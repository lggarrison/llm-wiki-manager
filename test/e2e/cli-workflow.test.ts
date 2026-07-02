import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runBuiltCli } from '../helpers/cli.js';
import { fm, writePage, PACKAGE_ROOT } from '../helpers/wiki.js';
import { packageBinPath } from '../../src/utils/fs.js';

const tmpDirs: string[] = [];

function makeTmpDir(withPackageJson = true): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-e2e-'));
  if (withPackageJson) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');
  }
  tmpDirs.push(dir);
  return dir;
}

function makeTmpProject(): string {
  return makeTmpDir(true);
}

function initProject(dir: string, extraArgs: string[] = []): ReturnType<typeof runBuiltCli> {
  return runBuiltCli(dir, ['init', '--project-name', 'acme', '--wiki-dir', 'wiki', ...extraArgs]);
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CLI e2e workflow', () => {
  it('init scaffolds wiki, AGENTS.md, install config, and CLI npm scripts', () => {
    const dir = makeTmpProject();
    const result = initProject(dir);

    expect(result.status).toBe(0);

    expect(existsSync(join(dir, 'wiki', 'schema.md'))).toBe(true);
    expect(existsSync(join(dir, 'wiki', 'index.md'))).toBe(true);
    expect(existsSync(join(dir, 'scripts', 'wiki', 'lint.mjs'))).toBe(false);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(dir, '.llm-wiki-manager.json'))).toBe(true);

    const schema = readFileSync(join(dir, 'wiki', 'schema.md'), 'utf8');
    expect(schema).toContain('Wiki Schema — acme');

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.scripts['wiki:lint']).toBe('llm-wiki-manager lint');
    expect(pkg.scripts['wiki:check']).toBe('llm-wiki-manager check');
    expect(pkg.scripts['wiki:doctor']).toBe('llm-wiki-manager doctor');
    expect(pkg.devDependencies?.['llm-wiki-manager']).toMatch(/^\^/);
  });

  it('init outro shows Final Step npm install when local bin is missing', () => {
    const dir = makeTmpProject();
    const result = initProject(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Final Step:');
    expect(result.stdout).toContain('npm install');
    expect(result.stdout).toContain('required before');
  });

  it('init outro omits Final Step npm install when local bin exists', () => {
    const dir = makeTmpProject();
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(packageBinPath(dir), '');

    const result = initProject(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Final Step:');
  });

  it('wiki CLI lint, build, and check after init', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    writePage(
      join(dir, 'wiki'),
      'concepts/hello.md',
      fm({ type: 'concept', title: 'Hello' }) + '\nIntro body.\n',
    );

    const lint = runBuiltCli(dir, ['lint', '--wiki-dir', 'wiki']);
    expect(lint.status).toBe(0);

    const build = runBuiltCli(dir, ['build', '--wiki-dir', 'wiki']);
    expect(build.status).toBe(0);
    expect(readFileSync(join(dir, 'wiki', 'index.md'), 'utf8')).toContain('Hello');

    const check = runBuiltCli(dir, ['check', '--wiki-dir', 'wiki']);
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

    const upgrade = runBuiltCli(dir, ['upgrade']);
    expect(upgrade.status).toBe(0);

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

  it('init scaffolds without package.json (no npm scripts added)', () => {
    const dir = makeTmpDir(false);
    const result = initProject(dir);

    expect(result.status).toBe(0);
    expect(existsSync(join(dir, 'wiki', 'schema.md'))).toBe(true);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(dir, 'package.json'))).toBe(false);
    expect(existsSync(join(dir, '.llm-wiki-manager.json'))).toBe(true);
  });

  it('re-init preserves existing log.md and schema.md', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const logPath = join(dir, 'wiki', 'log.md');
    const schemaPath = join(dir, 'wiki', 'schema.md');
    writeFileSync(logPath, '# Custom log history\n\nDo not overwrite.\n');
    writeFileSync(schemaPath, '# Custom schema\n\nUser edits.\n');

    const reInit = initProject(dir);
    expect(reInit.status).toBe(0);
    expect(readFileSync(logPath, 'utf8')).toContain('Do not overwrite.');
    expect(readFileSync(schemaPath, 'utf8')).toContain('User edits.');
  });

  it('upgrade --dry-run reports changes without writing files', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const schemaPath = join(dir, 'wiki', 'schema.md');
    const configPath = join(dir, '.llm-wiki-manager.json');
    const configBefore = readFileSync(configPath, 'utf8');
    writeFileSync(schemaPath, '# stale schema\n');

    const dryRun = runBuiltCli(dir, ['upgrade', '--dry-run']);
    expect(dryRun.status).toBe(0);
    expect(readFileSync(schemaPath, 'utf8')).toBe('# stale schema\n');
    expect(readFileSync(configPath, 'utf8')).toBe(configBefore);
  });

  it('init leaves index.md fresh so check passes without a manual build', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const check = runBuiltCli(dir, ['check', '--wiki-dir', 'wiki']);
    expect(check.status).toBe(0);
    expect(check.stdout).toContain('up to date');
  });

  it('upgrade preserves user content after the managed section end marker', () => {
    const dir = makeTmpProject();
    expect(initProject(dir).status).toBe(0);

    const agentsPath = join(dir, 'AGENTS.md');
    const agentsBefore = readFileSync(agentsPath, 'utf8');
    writeFileSync(
      agentsPath,
      `${agentsBefore.trimEnd()}\n\n## Custom notes\n\nUser-owned content.\n`,
    );

    writeFileSync(join(dir, 'wiki', 'schema.md'), '# stale schema\n');

    const upgrade = runBuiltCli(dir, ['upgrade']);
    expect(upgrade.status).toBe(0);

    const agentsAfter = readFileSync(agentsPath, 'utf8');
    expect(agentsAfter).toContain('## Custom notes');
    expect(agentsAfter).toContain('User-owned content.');
    expect(agentsAfter).toContain('[`wiki/AGENTS.md`](wiki/AGENTS.md)');
  });

  it('init succeeds when package.json has a UTF-8 BOM', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      String.fromCharCode(0xfeff) + JSON.stringify({ name: 'acme' }, null, 2) + '\n',
      'utf8',
    );

    expect(initProject(dir).status).toBe(0);
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(packageBinPath(dir), '');

    const doctor = runBuiltCli(dir, ['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain('No problems found');
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

  it('--help prints usage listing commands and exits 0', () => {
    const dir = makeTmpProject();
    const result = runBuiltCli(dir, ['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: llm-wiki-manager');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('upgrade');
    expect(result.stdout).toContain('lint');
    expect(result.stdout).toContain('doctor');
  });

  it('an unknown command exits 1 with usage on stderr', () => {
    const dir = makeTmpProject();
    const result = runBuiltCli(dir, ['bogus']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command: bogus');
    expect(result.stderr).toContain('Usage: llm-wiki-manager');
  });
});
