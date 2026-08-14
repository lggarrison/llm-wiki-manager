import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  interpolate,
  amendFile,
  copyTemplate,
  templatePath,
  mergePackageJsonScripts,
  mergePackageJsonDevDependency,
  syncPackageJsonScripts,
  getInstalledPackageVersion,
  getPackageInstallStatus,
  needsPackageInstall,
  compareVersions,
  isPackageBinInstalled,
  packageBinPath,
  PACKAGE_NAME,
  replaceManagedSection,
  scaffoldWikiTemplates,
  buildTemplateVars,
  readInstallConfig,
  writeInstallConfig,
  inferInstallConfig,
  isExistingInstall,
  WIKI_SCRIPT_KEYS,
  wikiScriptCandidates,
  scopeSlugFromFocusDir,
  scaffoldEntityOverviews,
  scaffoldWikiEmptyDirs,
  readJsonFile,
  WIKI_EMPTY_DIRS,
  WIKI_INIT_ONLY_PATHS,
  WIKI_META_UPGRADE_PATHS,
} from './fs.js';

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-wiki-fs-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  const { rmSync } = await import('fs');
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('readJsonFile', () => {
  it('parses JSON written with a UTF-8 BOM (as PowerShell and some editors produce)', () => {
    const dir = makeTmpDir();
    const path = join(dir, 'package.json');
    writeFileSync(path, String.fromCharCode(0xfeff) + '{ "name": "bom-app" }', 'utf8');
    expect(readJsonFile<{ name: string }>(path)).toEqual({ name: 'bom-app' });
  });
});

describe('interpolate', () => {
  it('substitutes a known placeholder', () => {
    expect(interpolate('Hello {{NAME}}', { NAME: 'World' })).toBe('Hello World');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(interpolate('Hello {{NAME}}', {})).toBe('Hello {{NAME}}');
  });

  it('substitutes multiple distinct placeholders', () => {
    expect(interpolate('{{A}}-{{B}}', { A: '1', B: '2' })).toBe('1-2');
  });

  it('substitutes repeated occurrences of the same placeholder', () => {
    expect(interpolate('{{X}} and {{X}}', { X: 'y' })).toBe('y and y');
  });

  it('returns the string unchanged when there are no placeholders', () => {
    expect(interpolate('no placeholders here', { X: 'y' })).toBe('no placeholders here');
  });

  it('handles an empty string', () => {
    expect(interpolate('', { X: 'y' })).toBe('');
  });
});

describe('amendFile', () => {
  it('creates the file when it does not exist', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    const result = amendFile(target, '# Section\n\nbody');
    expect(result).toBe(true);
    const content = readFileSync(target, 'utf8');
    expect(content).toContain('<!-- llm-wiki-manager -->');
    expect(content).toContain('# Section\n\nbody');
  });

  it('appends with a delimiter and downgrades the H1 when the file already exists', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(target, '# Existing project notes\n\nSome content.\n');

    const result = amendFile(target, '# LLM Wiki\n\nWiki instructions.');
    expect(result).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('# Existing project notes');
    expect(content).toContain('<!-- llm-wiki-manager -->');
    expect(content).toContain('## LLM Wiki');
    expect(content).not.toMatch(/^# LLM Wiki/m);
  });

  it('is idempotent: a second call is a no-op once the delimiter is present', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');

    amendFile(target, '# LLM Wiki\n\nWiki instructions.');
    const afterFirst = readFileSync(target, 'utf8');

    const result = amendFile(target, '# LLM Wiki\n\nDifferent instructions.');
    expect(result).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe(afterFirst);
  });
});

describe('copyTemplate', () => {
  it('copies a directory tree to the destination', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    writeFileSync(join(src, 'a.md'), '# A');
    mkdirSync(join(src, 'nested'), { recursive: true });
    writeFileSync(join(src, 'nested', 'b.md'), '# B');

    copyTemplate(src, dest);

    expect(existsSync(join(dest, 'a.md'))).toBe(true);
    expect(existsSync(join(dest, 'nested', 'b.md'))).toBe(true);
  });

  it('interpolates placeholders in copied .md/.mjs/.js files', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    writeFileSync(join(src, 'page.md'), 'Project: {{PROJECT_NAME}}');
    writeFileSync(join(src, 'script.mjs'), '// {{PROJECT_NAME}}');

    copyTemplate(src, dest, { PROJECT_NAME: 'acme' });

    expect(readFileSync(join(dest, 'page.md'), 'utf8')).toBe('Project: acme');
    expect(readFileSync(join(dest, 'script.mjs'), 'utf8')).toBe('// acme');
  });

  it('interpolates .entity-scopes and .json template files', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    mkdirSync(join(src, '.obsidian'), { recursive: true });
    writeFileSync(join(src, '.entity-scopes'), 'scopes:\n{{ENTITY_SCOPE_LINES}}\n');
    writeFileSync(join(src, '.obsidian', 'app.json'), '{"project":"{{PROJECT_NAME}}"}');

    copyTemplate(src, dest, { ENTITY_SCOPE_LINES: 'api\nui', PROJECT_NAME: 'acme' });

    expect(readFileSync(join(dest, '.entity-scopes'), 'utf8')).toContain('api\nui');
    expect(readFileSync(join(dest, '.obsidian', 'app.json'), 'utf8')).toContain('acme');
  });

  it('does not modify files when no vars are given', () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    writeFileSync(join(src, 'page.md'), 'Project: {{PROJECT_NAME}}');

    copyTemplate(src, dest);

    expect(readFileSync(join(dest, 'page.md'), 'utf8')).toBe('Project: {{PROJECT_NAME}}');
  });
});

describe('scopeSlugFromFocusDir', () => {
  it('uses the last path segment as the slug', () => {
    expect(scopeSlugFromFocusDir('src/commands')).toBe('commands');
    expect(scopeSlugFromFocusDir('templates')).toBe('templates');
  });

  it('strips a leading underscore from the segment', () => {
    expect(scopeSlugFromFocusDir('src/ui/_national-map')).toBe('national-map');
  });
});

describe('scaffoldEntityOverviews', () => {
  it('creates draft overview stubs for each focus directory', () => {
    const dir = makeTmpDir();
    scaffoldWikiEmptyDirs(dir);
    const slugs = scaffoldEntityOverviews(dir, ['src/commands', 'templates'], '2026-06-30');
    expect(slugs).toEqual(['commands', 'templates']);
    const commands = readFileSync(join(dir, 'entities', 'commands.md'), 'utf8');
    expect(commands).toContain('type: overview');
    expect(commands).toContain('tags: [commands]');
    expect(commands).toContain('src/commands/');
  });

  it('does not overwrite existing entity pages', () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, 'entities'), { recursive: true });
    writeFileSync(join(dir, 'entities', 'api.md'), 'existing');
    scaffoldEntityOverviews(dir, ['src/api'], '2026-06-30');
    expect(readFileSync(join(dir, 'entities', 'api.md'), 'utf8')).toBe('existing');
  });
});

describe('scaffoldWikiEmptyDirs', () => {
  it('creates every expected empty directory with a .gitkeep file', () => {
    const dir = makeTmpDir();
    scaffoldWikiEmptyDirs(dir);

    for (const sub of WIKI_EMPTY_DIRS) {
      const subDir = join(dir, sub);
      expect(existsSync(subDir)).toBe(true);
      expect(existsSync(join(subDir, '.gitkeep'))).toBe(true);
    }
  });

  it('is idempotent when directories already exist', () => {
    const dir = makeTmpDir();
    scaffoldWikiEmptyDirs(dir);
    writeFileSync(join(dir, 'concepts', 'existing.md'), '# keep me\n');

    scaffoldWikiEmptyDirs(dir);

    expect(readFileSync(join(dir, 'concepts', 'existing.md'), 'utf8')).toBe('# keep me\n');
    expect(existsSync(join(dir, 'archive', '.gitkeep'))).toBe(true);
  });
});

/** Mirrors init's wiki-directory steps (templates, empty dirs, optional entity overviews). */
function scaffoldFullWiki(
  wikiDest: string,
  options: { projectName?: string; focusDirs?: string[]; initTimestamp?: string } = {},
) {
  const initTimestamp = options.initTimestamp ?? '2026-06-30T00:00:00Z';
  const focusDirs = options.focusDirs ?? [];
  const vars = buildTemplateVars({
    projectName: options.projectName ?? 'acme',
    wikiDir: 'wiki',
    focusDirs,
    initTimestamp,
  });

  scaffoldWikiTemplates(wikiDest, vars, { overwrite: false });
  scaffoldWikiEmptyDirs(wikiDest);
  if (focusDirs.length > 0) {
    scaffoldEntityOverviews(wikiDest, focusDirs, initTimestamp);
  }

  return vars;
}

describe('full wiki scaffold', () => {
  const expectedTemplateFiles = [
    ...WIKI_META_UPGRADE_PATHS,
    ...WIKI_INIT_ONLY_PATHS,
  ] as readonly string[];

  it('creates all template files and empty directory layout from init', () => {
    const dir = makeTmpDir();
    const vars = scaffoldFullWiki(dir, { projectName: 'acme' });

    for (const relPath of expectedTemplateFiles) {
      expect(existsSync(join(dir, relPath))).toBe(true);
    }

    for (const sub of WIKI_EMPTY_DIRS) {
      expect(existsSync(join(dir, sub, '.gitkeep'))).toBe(true);
    }

    expect(readFileSync(join(dir, 'schema.md'), 'utf8')).toContain('Wiki Schema — acme');
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('acme');
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('schema.md');
    expect(readFileSync(join(dir, 'raw', 'raw.md'), 'utf8')).toContain('Raw Sources');
    expect(readFileSync(join(dir, '.entity-scopes'), 'utf8')).toContain(vars.ENTITY_SCOPE_LINES);
    expect(readFileSync(join(dir, 'log.md'), 'utf8')).toContain('Wiki Log — acme');
  });

  it('creates entity overview stubs when focus directories are provided', () => {
    const dir = makeTmpDir();
    scaffoldFullWiki(dir, {
      projectName: 'acme',
      focusDirs: ['src/commands', 'templates'],
      initTimestamp: '2026-06-30T00:00:00Z',
    });

    expect(existsSync(join(dir, 'entities', 'commands.md'))).toBe(true);
    expect(existsSync(join(dir, 'entities', 'templates.md'))).toBe(true);
    expect(readFileSync(join(dir, 'entities', 'commands.md'), 'utf8')).toContain('type: overview');
    expect(readFileSync(join(dir, 'entities', 'templates.md'), 'utf8')).toContain(
      'tags: [templates]',
    );
    expect(readFileSync(join(dir, '.entity-scopes'), 'utf8')).toContain('commands');
    expect(readFileSync(join(dir, '.entity-scopes'), 'utf8')).toContain('templates');
  });

  it('does not create entity overview stubs without focus directories', () => {
    const dir = makeTmpDir();
    scaffoldFullWiki(dir);

    expect(existsSync(join(dir, 'entities', '.gitkeep'))).toBe(true);
    expect(existsSync(join(dir, 'entities', 'commands.md'))).toBe(false);
  });
});

describe('wiki template bundle', () => {
  it('includes vault entry files', () => {
    const dest = makeTmpDir();
    copyTemplate(templatePath('wiki'), dest, {
      PROJECT_NAME: 'acme',
      WIKI_DIR: 'wiki',
      INIT_TIMESTAMP: '2026-06-30T00:00:00Z',
      ENTITY_SCOPE_LINES: 'api',
      FOCUS_DIRS: '`src/`',
      FOCUS_DIRS_LIST: '- `src/`',
    });

    expect(existsSync(join(dest, 'README.md'))).toBe(true);
    expect(existsSync(join(dest, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(dest, 'raw', 'raw.md'))).toBe(true);
    expect(existsSync(join(dest, '.entity-scopes'))).toBe(true);
    expect(readFileSync(join(dest, 'README.md'), 'utf8')).toContain('acme');
    expect(readFileSync(join(dest, '.entity-scopes'), 'utf8')).toContain('api');
  });
});

describe('templatePath', () => {
  it('resolves to an existing file under the package templates directory', () => {
    const p = templatePath('wiki', 'schema.md');
    expect(p.endsWith(join('templates', 'wiki', 'schema.md'))).toBe(true);
    expect(existsSync(p)).toBe(true);
  });
});

describe('mergePackageJsonScripts', () => {
  it('adds wiki scripts to an existing package.json', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');

    const result = mergePackageJsonScripts(dir);
    expect(result).toEqual({
      status: 'merged',
      added: [...WIKI_SCRIPT_KEYS],
    });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts).toEqual(wikiScriptCandidates());
  });

  it('does not add devDependencies by itself', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');

    mergePackageJsonScripts(dir);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.devDependencies).toBeUndefined();
  });

  it('is idempotent when wiki scripts already exist', () => {
    const dir = makeTmpDir();
    const original = {
      name: 'acme',
      scripts: { 'wiki:lint': 'llm-wiki-manager lint' },
    };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(original, null, 2) + '\n');

    const result = mergePackageJsonScripts(dir);
    expect(result).toEqual({
      status: 'merged',
      added: WIKI_SCRIPT_KEYS.filter((k) => k !== 'wiki:lint'),
    });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts['wiki:lint']).toBe('llm-wiki-manager lint');
  });

  it('returns unchanged when all wiki scripts are already present', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          scripts: wikiScriptCandidates(),
        },
        null,
        2,
      ) + '\n',
    );

    const result = mergePackageJsonScripts(dir);
    expect(result).toEqual({ status: 'unchanged' });
  });

  it('returns no-package-json when package.json is missing', () => {
    const dir = makeTmpDir();
    expect(mergePackageJsonScripts(dir)).toEqual({ status: 'no-package-json' });
  });
});

describe('mergePackageJsonDevDependency', () => {
  it('adds llm-wiki-manager to devDependencies when absent', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');

    const result = mergePackageJsonDevDependency(dir, '1.0.0');
    expect(result).toEqual({ status: 'merged', version: '1.0.0' });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.devDependencies).toEqual({ [PACKAGE_NAME]: '^1.0.0' });
  });

  it('updates an existing devDependency to match the running version', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          devDependencies: { [PACKAGE_NAME]: '^1.0.0' },
        },
        null,
        2,
      ) + '\n',
    );

    const result = mergePackageJsonDevDependency(dir, '1.0.2');
    expect(result).toEqual({ status: 'updated', version: '1.0.2', previous: '^1.0.0' });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.devDependencies[PACKAGE_NAME]).toBe('^1.0.2');
  });

  it('does not overwrite an existing devDependency when already on target version', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          devDependencies: { [PACKAGE_NAME]: '^1.0.2' },
        },
        null,
        2,
      ) + '\n',
    );

    const result = mergePackageJsonDevDependency(dir, '1.0.2');
    expect(result).toEqual({ status: 'unchanged' });
  });

  it('does not downgrade an existing devDependency when the running version is older', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          devDependencies: { [PACKAGE_NAME]: '^2.0.0' },
        },
        null,
        2,
      ) + '\n',
    );

    const result = mergePackageJsonDevDependency(dir, '1.0.2');
    expect(result).toEqual({ status: 'unchanged' });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.devDependencies[PACKAGE_NAME]).toBe('^2.0.0');
  });

  it('does not overwrite an existing dependency entry', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          dependencies: { [PACKAGE_NAME]: '^1.0.0' },
        },
        null,
        2,
      ) + '\n',
    );

    expect(mergePackageJsonDevDependency(dir, '2.0.0')).toEqual({ status: 'unchanged' });
  });

  it('returns no-package-json when package.json is missing', () => {
    const dir = makeTmpDir();
    expect(mergePackageJsonDevDependency(dir)).toEqual({ status: 'no-package-json' });
  });
});

describe('compareVersions', () => {
  it('orders semver components numerically', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.2')).toBeLessThan(0);
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
});

describe('getPackageInstallStatus', () => {
  it('reports missing when node_modules has no package', () => {
    const dir = makeTmpDir();
    expect(getPackageInstallStatus(dir, '1.0.2')).toEqual({
      needsInstall: true,
      reason: 'missing',
    });
    expect(needsPackageInstall(dir, '1.0.2')).toBe(true);
  });

  it('reports stale when installed version differs from target', () => {
    const dir = makeTmpDir();
    const pkgDir = join(dir, 'node_modules', PACKAGE_NAME);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME, version: '1.0.0' }, null, 2) + '\n',
    );
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(packageBinPath(dir), '');

    expect(getPackageInstallStatus(dir, '1.0.2')).toEqual({
      needsInstall: true,
      reason: 'stale',
      installedVersion: '1.0.0',
      targetVersion: '1.0.2',
    });
  });

  it('reports no install needed when versions match', () => {
    const dir = makeTmpDir();
    const pkgDir = join(dir, 'node_modules', PACKAGE_NAME);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME, version: '1.0.2' }, null, 2) + '\n',
    );
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(packageBinPath(dir), '');

    expect(getPackageInstallStatus(dir, '1.0.2')).toEqual({ needsInstall: false });
    expect(needsPackageInstall(dir, '1.0.2')).toBe(false);
  });

  it('reports no install needed when installed version is newer than target', () => {
    const dir = makeTmpDir();
    const pkgDir = join(dir, 'node_modules', PACKAGE_NAME);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME, version: '2.0.0' }, null, 2) + '\n',
    );
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(packageBinPath(dir), '');

    expect(getPackageInstallStatus(dir, '1.0.2')).toEqual({ needsInstall: false });
  });

  it('reports missing when package version matches but the bin shim is absent', () => {
    const dir = makeTmpDir();
    const pkgDir = join(dir, 'node_modules', PACKAGE_NAME);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME, version: '1.0.2' }, null, 2) + '\n',
    );

    expect(getPackageInstallStatus(dir, '1.0.2')).toEqual({
      needsInstall: true,
      reason: 'missing',
    });
  });
});

describe('getInstalledPackageVersion', () => {
  it('reads the installed package version from node_modules', () => {
    const dir = makeTmpDir();
    const pkgDir = join(dir, 'node_modules', PACKAGE_NAME);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME, version: '1.0.2' }, null, 2) + '\n',
    );

    expect(getInstalledPackageVersion(dir)).toBe('1.0.2');
  });
});

describe('isPackageBinInstalled', () => {
  it('detects a local binary shim', () => {
    const dir = makeTmpDir();
    const binDir = join(dir, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(packageBinPath(dir), '');

    expect(isPackageBinInstalled(dir)).toBe(true);
  });

  it('detects a Windows .cmd shim', () => {
    const dir = makeTmpDir();
    const binDir = join(dir, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(`${packageBinPath(dir)}.cmd`, '');

    expect(isPackageBinInstalled(dir)).toBe(true);
  });
});

describe('replaceManagedSection', () => {
  it('replaces the managed block while preserving content before the delimiter', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(
      target,
      '# My Project\n\nCustom notes.\n\n<!-- llm-wiki-manager -->\n# Old Wiki\n\nStale.\n<!-- /llm-wiki-manager -->\n',
    );

    const ok = replaceManagedSection(target, '# LLM Wiki\n\nFresh instructions.');
    expect(ok).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Custom notes.');
    expect(content).toContain('# LLM Wiki');
    expect(content).toContain('Fresh instructions.');
    expect(content).not.toContain('Stale.');
  });

  it('returns false when delimiter is missing on an existing file', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(target, '# No delimiter here\n');
    expect(replaceManagedSection(target, '# Section')).toBe(false);
  });

  it('preserves user content after the end marker', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(
      target,
      '# My Project\n\n<!-- llm-wiki-manager -->\n# Old Wiki\n\nStale.\n<!-- /llm-wiki-manager -->\n\n## My own section\n\nHand-written notes, no HTML comment anywhere.\n',
    );

    const ok = replaceManagedSection(target, '# LLM Wiki\n\nFresh.');
    expect(ok).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Fresh.');
    expect(content).not.toContain('Stale.');
    expect(content).toContain('## My own section');
    expect(content).toContain('Hand-written notes, no HTML comment anywhere.');
  });

  it('preserves an unbounded legacy block without an end marker', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(
      target,
      '# My Project\n\n<!-- llm-wiki-manager -->\n# Old Wiki\n\nStale.\n\n## My own section\n\nKeep these notes.\n',
    );

    const ok = replaceManagedSection(target, '# LLM Wiki\n\nFresh.');
    expect(ok).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('Fresh.');
    expect(content).toContain('Stale.');
    expect(content).toContain('## My own section');
    expect(content).toContain('Keep these notes.');
    expect(content).toContain('<!-- /llm-wiki-manager -->');
  });

  it('ignores copied end markers inside fenced code when preserving a legacy block', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(
      target,
      [
        '# My Project',
        '',
        '<!-- llm-wiki-manager -->',
        '# Old Wiki',
        '',
        'Stale.',
        '',
        '## My own section',
        '',
        'Document the old marker without making it a managed boundary:',
        '',
        '```markdown',
        '<!-- /llm-wiki-manager -->',
        '```',
        '',
        'Keep these notes.',
        '',
      ].join('\n'),
    );

    const ok = replaceManagedSection(target, '# LLM Wiki\n\nFresh.');
    expect(ok).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('Fresh.');
    expect(content).toContain('Stale.');
    expect(content).toContain('## My own section');
    expect(content).toContain('Keep these notes.');
    expect(content).toContain('```markdown\n<!-- /llm-wiki-manager -->\n```');
  });

  it('amendFile writes both start and end markers', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    amendFile(target, '# LLM Wiki\n\nInstructions.');
    const content = readFileSync(target, 'utf8');
    expect(content).toContain('<!-- llm-wiki-manager -->');
    expect(content).toContain('<!-- /llm-wiki-manager -->');
  });

  it('does not duplicate markers when the section template already includes them', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    amendFile(
      target,
      '<!-- llm-wiki-manager -->\n\n# LLM Wiki\n\nInstructions.\n\n<!-- /llm-wiki-manager -->',
    );

    const content = readFileSync(target, 'utf8');
    expect(content.match(/<!-- llm-wiki-manager -->/g)).toHaveLength(1);
    expect(content.match(/<!-- \/llm-wiki-manager -->/g)).toHaveLength(1);
  });

  it('strips stray end markers from nested-marker upgrades while preserving user content', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(
      target,
      '# My Project\n\n<!-- llm-wiki-manager -->\n<!-- llm-wiki-manager -->\n# Old Wiki\n\nStale.\n<!-- /llm-wiki-manager -->\n<!-- /llm-wiki-manager -->\n\n## My own section\n\nKeep these notes.\n',
    );

    const ok = replaceManagedSection(target, '# LLM Wiki\n\nFresh.');
    expect(ok).toBe(true);

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('Fresh.');
    expect(content).not.toContain('Stale.');
    expect(content).toContain('## My own section');
    expect(content).toContain('Keep these notes.');
    expect(content.match(/<!-- \/llm-wiki-manager -->/g)).toHaveLength(1);
  });
});

describe('scaffoldWikiTemplates', () => {
  it('skips existing log.md on re-init', () => {
    const dest = makeTmpDir();
    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: ['src'],
      initTimestamp: '2026-06-30T00:00:00Z',
    });

    scaffoldWikiTemplates(dest, vars, { overwrite: false });
    const logPath = join(dest, 'log.md');
    writeFileSync(logPath, '# Custom log history\n\nDo not overwrite.\n');

    scaffoldWikiTemplates(dest, vars, { overwrite: false });
    expect(readFileSync(logPath, 'utf8')).toContain('Do not overwrite.');
  });

  it('overwrites schema.md when overwrite is true', () => {
    const dest = makeTmpDir();
    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: [],
      initTimestamp: '2026-06-30T00:00:00Z',
    });

    scaffoldWikiTemplates(dest, vars, { overwrite: false });
    const schemaPath = join(dest, 'schema.md');
    writeFileSync(schemaPath, '# Old schema\n');

    scaffoldWikiTemplates(dest, vars, { overwrite: true });
    expect(readFileSync(schemaPath, 'utf8')).toContain('Wiki Schema — acme');
    expect(readFileSync(schemaPath, 'utf8')).not.toContain('# Old schema');
  });
});

describe('syncPackageJsonScripts', () => {
  it('adds missing wiki scripts including wiki:setup:husky', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        { name: 'acme', scripts: { 'wiki:lint': 'node scripts/wiki/lint.mjs' } },
        null,
        2,
      ) + '\n',
    );

    const result = syncPackageJsonScripts(dir);
    expect(result.status).toBe('synced');
    if (result.status === 'synced') {
      expect(result.added).toContain('wiki:setup:husky');
      expect(result.updated).toContain('wiki:lint');
    }

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts['wiki:setup:husky']).toBe('llm-wiki-manager setup-husky');
    expect(pkg.scripts['wiki:lint']).toBe('llm-wiki-manager lint');
  });

  it('updates changed wiki script commands', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          scripts: { 'wiki:lint': 'node old/path/lint.mjs' },
        },
        null,
        2,
      ) + '\n',
    );

    const result = syncPackageJsonScripts(dir);
    expect(result.status).toBe('synced');
    if (result.status === 'synced') {
      expect(result.updated).toContain('wiki:lint');
    }

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts['wiki:lint']).toBe('llm-wiki-manager lint');
  });
});

describe('install config', () => {
  it('writes and reads .llm-wiki-manager.json', () => {
    const dir = makeTmpDir();
    const config = {
      version: '0.1.0',
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: ['src'],
    };
    writeInstallConfig(dir, config);
    expect(readInstallConfig(dir)).toEqual(config);
  });

  it('readInstallConfig parses .llm-wiki-manager.json with UTF-8 BOM', () => {
    const dir = makeTmpDir();
    const config = {
      version: '0.1.0',
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: ['src'],
    };
    const path = join(dir, '.llm-wiki-manager.json');
    writeFileSync(
      path,
      String.fromCharCode(0xfeff) + JSON.stringify(config, null, 2) + '\n',
      'utf8',
    );
    expect(readInstallConfig(dir)).toEqual(config);
  });

  it('rejects partial install config before callers can use missing focusDirs', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({ version: '0.1.0', projectName: 'acme', wikiDir: 'wiki' }, null, 2) + '\n',
    );

    expect(() => readInstallConfig(dir)).toThrow(
      '.llm-wiki-manager.json is invalid: "focusDirs" must be an array of strings',
    );
  });

  it('rejects partial install config before template placeholders are refreshed', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.llm-wiki-manager.json'),
      JSON.stringify({ version: '0.1.0', wikiDir: 'wiki', focusDirs: [] }, null, 2) + '\n',
    );

    expect(() => readInstallConfig(dir)).toThrow(
      '.llm-wiki-manager.json is invalid: "projectName" must be a non-empty string',
    );
  });

  it('infers paths from AGENTS.md and schema.md', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-app' }, null, 2) + '\n');
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '<!-- llm-wiki-manager -->\nRead [`docs/AGENTS.md`](docs/AGENTS.md)\n',
    );
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'schema.md'), '# schema\n');

    const inferred = inferInstallConfig(dir);
    expect(inferred?.wikiDir).toBe('docs');
    expect(inferred?.projectName).toBe('my-app');
  });

  it('detects existing installs', () => {
    const dir = makeTmpDir();
    expect(isExistingInstall(dir, 'wiki')).toBe(false);
    mkdirSync(join(dir, 'wiki'), { recursive: true });
    writeFileSync(join(dir, 'wiki', 'schema.md'), '# schema\n');
    expect(isExistingInstall(dir, 'wiki')).toBe(true);
  });
});

describe('buildTemplateVars', () => {
  it('builds entity scope lines from focus directories', () => {
    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      focusDirs: ['src/commands', 'templates'],
    });
    expect(vars.ENTITY_SCOPE_LINES).toBe('commands\ntemplates');
  });
});
