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
  syncPackageJsonScripts,
  replaceManagedSection,
  scaffoldWikiTemplates,
  scaffoldScripts,
  upgradeScripts,
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

describe('wiki template bundle', () => {
  it('includes vault entry files', () => {
    const dest = makeTmpDir();
    copyTemplate(templatePath('wiki'), dest, {
      PROJECT_NAME: 'acme',
      WIKI_DIR: 'wiki',
      SCRIPTS_DIR: 'scripts/wiki',
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

    const result = mergePackageJsonScripts(dir, 'scripts/wiki');
    expect(result).toEqual({
      status: 'merged',
      added: [...WIKI_SCRIPT_KEYS],
    });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts).toEqual(wikiScriptCandidates('scripts/wiki'));
  });

  it('uses a custom scripts directory in script paths', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'acme' }, null, 2) + '\n');

    mergePackageJsonScripts(dir, 'tools/wiki-scripts');

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts).toEqual(wikiScriptCandidates('tools/wiki-scripts'));
  });

  it('is idempotent when wiki scripts already exist', () => {
    const dir = makeTmpDir();
    const original = {
      name: 'acme',
      scripts: { 'wiki:lint': 'node custom/lint.mjs' },
    };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(original, null, 2) + '\n');

    const result = mergePackageJsonScripts(dir, 'scripts/wiki');
    expect(result).toEqual({
      status: 'merged',
      added: WIKI_SCRIPT_KEYS.filter((k) => k !== 'wiki:lint'),
    });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts['wiki:lint']).toBe('node custom/lint.mjs');
  });

  it('returns unchanged when all wiki scripts are already present', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          scripts: wikiScriptCandidates('scripts/wiki'),
        },
        null,
        2,
      ) + '\n',
    );

    const result = mergePackageJsonScripts(dir, 'scripts/wiki');
    expect(result).toEqual({ status: 'unchanged' });
  });

  it('returns no-package-json when package.json is missing', () => {
    const dir = makeTmpDir();
    expect(mergePackageJsonScripts(dir, 'scripts/wiki')).toEqual({ status: 'no-package-json' });
  });
});

describe('replaceManagedSection', () => {
  it('replaces the managed block while preserving content before the delimiter', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'AGENTS.md');
    writeFileSync(
      target,
      '# My Project\n\nCustom notes.\n\n<!-- llm-wiki-manager -->\n# Old Wiki\n\nStale.\n',
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
});

describe('scaffoldWikiTemplates', () => {
  it('skips existing log.md on re-init', () => {
    const dest = makeTmpDir();
    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      scriptsDir: 'scripts/wiki',
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
      scriptsDir: 'scripts/wiki',
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

describe('scaffoldScripts', () => {
  it('does not overwrite existing scripts on init', () => {
    const dest = makeTmpDir();
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'lint.mjs'), '// custom lint\n');

    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      scriptsDir: 'scripts/wiki',
      focusDirs: [],
    });

    const result = scaffoldScripts(dest, vars, { overwrite: false });
    expect(result.skipped).toContain('lint.mjs');
    expect(readFileSync(join(dest, 'lint.mjs'), 'utf8')).toBe('// custom lint\n');
  });

  it('overwrites scripts on upgrade', () => {
    const dest = makeTmpDir();
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'help.mjs'), '// old help\n');

    const vars = buildTemplateVars({
      projectName: 'acme',
      wikiDir: 'wiki',
      scriptsDir: 'scripts/wiki',
      focusDirs: [],
    });

    upgradeScripts(dest, vars);
    expect(readFileSync(join(dest, 'help.mjs'), 'utf8')).toContain('help.mjs');
    expect(readFileSync(join(dest, 'help.mjs'), 'utf8')).not.toBe('// old help\n');
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

    const result = syncPackageJsonScripts(dir, 'scripts/wiki');
    expect(result.status).toBe('synced');
    if (result.status === 'synced') {
      expect(result.added).toContain('wiki:setup:husky');
    }

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts['wiki:setup:husky']).toBe('node scripts/wiki/setup-husky.mjs');
  });

  it('updates changed wiki script commands', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme',
          scripts: wikiScriptCandidates('old/path'),
        },
        null,
        2,
      ) + '\n',
    );

    const result = syncPackageJsonScripts(dir, 'scripts/wiki');
    expect(result.status).toBe('synced');
    if (result.status === 'synced') {
      expect(result.updated.length).toBeGreaterThan(0);
    }

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts['wiki:lint']).toBe('node scripts/wiki/lint.mjs');
  });
});

describe('install config', () => {
  it('writes and reads .llm-wiki-manager.json', () => {
    const dir = makeTmpDir();
    const config = {
      version: '0.1.0',
      projectName: 'acme',
      wikiDir: 'wiki',
      scriptsDir: 'scripts/wiki',
      focusDirs: ['src'],
    };
    writeInstallConfig(dir, config);
    expect(readInstallConfig(dir)).toEqual(config);
  });

  it('infers paths from package.json and AGENTS.md', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'my-app',
          scripts: { 'wiki:lint': 'node tools/wiki/lint.mjs' },
        },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '<!-- llm-wiki-manager -->\nRead [`docs/AGENTS.md`](docs/AGENTS.md)\n',
    );
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'schema.md'), '# schema\n');

    const inferred = inferInstallConfig(dir);
    expect(inferred?.scriptsDir).toBe('tools/wiki');
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
      scriptsDir: 'scripts/wiki',
      focusDirs: ['src/commands', 'templates'],
    });
    expect(vars.ENTITY_SCOPE_LINES).toBe('commands\ntemplates');
  });
});
