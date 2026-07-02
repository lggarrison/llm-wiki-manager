import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

export const PACKAGE_NAME = 'llm-wiki-manager';
export const INSTALL_CONFIG_FILENAME = '.llm-wiki-manager.json';
export const MANAGED_SECTION_DELIMITER = '<!-- llm-wiki-manager -->';
export const MANAGED_SECTION_END = '<!-- /llm-wiki-manager -->';

export type InstallConfig = {
  version: string;
  projectName: string;
  wikiDir: string;
  focusDirs: string[];
};

export type CopyTemplateResult = {
  created: string[];
  skipped: string[];
  updated: string[];
};

/** Wiki meta files refreshed by upgrade (not index.md or log.md). */
export const WIKI_META_UPGRADE_PATHS = [
  'schema.md',
  'AGENTS.md',
  'README.md',
  'raw/raw.md',
  '.entity-scopes',
] as const;

/** Written on first init only; skipped on re-init. */
export const WIKI_INIT_ONLY_PATHS = ['index.md', 'log.md'] as const;

function findPackageRoot(startFile: string): string {
  let dir = dirname(startFile);
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('llm-wiki-manager: could not locate package root');
}

const PACKAGE_ROOT = findPackageRoot(fileURLToPath(import.meta.url));

export function templatePath(...parts: string[]): string {
  return join(PACKAGE_ROOT, 'templates', ...parts);
}

export function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function shouldInterpolateFile(name: string): boolean {
  return /\.(md|mjs|js|json)$/.test(name) || name === '.entity-scopes';
}

function walkAndInterpolate(dir: string, vars: Record<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkAndInterpolate(full, vars);
    } else if (shouldInterpolateFile(entry)) {
      const content = readFileSync(full, 'utf8');
      const updated = interpolate(content, vars);
      if (updated !== content) writeFileSync(full, updated, 'utf8');
    }
  }
}

export function copyTemplate(src: string, dest: string, vars: Record<string, string> = {}): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  if (Object.keys(vars).length > 0) {
    walkAndInterpolate(dest, vars);
  }
}

/** Read and parse JSON, tolerating a UTF-8 BOM (npm does; Windows editors write them). */
export function readJsonFile<T>(path: string): T {
  let raw = readFileSync(path, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw) as T;
}

export function getPackageVersion(): string {
  const pkg = readJsonFile<{ version: string }>(join(PACKAGE_ROOT, 'package.json'));
  return pkg.version;
}

export function buildTemplateVars(input: {
  projectName: string;
  wikiDir: string;
  focusDirs: string[];
  initTimestamp?: string;
}): Record<string, string> {
  const initTimestamp = input.initTimestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const entitySlugs = input.focusDirs.map((d) => scopeSlugFromFocusDir(d));
  const entityScopeLines =
    entitySlugs.length > 0
      ? entitySlugs.join('\n')
      : '# Add scope slugs below as you define documented source areas';

  return {
    PROJECT_NAME: input.projectName,
    WIKI_DIR: input.wikiDir,
    INIT_TIMESTAMP: initTimestamp,
    ENTITY_SCOPE_LINES: entityScopeLines,
    FOCUS_DIRS:
      input.focusDirs.length > 0
        ? input.focusDirs.map((d) => `\`${d}/\``).join(', ')
        : 'the entire project',
    FOCUS_DIRS_LIST:
      input.focusDirs.length > 0
        ? input.focusDirs.map((d) => `- \`${d}/\``).join('\n')
        : '- _(whole project — no specific directory scope)_',
  };
}

export function installConfigPath(projectRoot: string): string {
  return join(projectRoot, INSTALL_CONFIG_FILENAME);
}

export function readInstallConfig(projectRoot: string): InstallConfig | null {
  const path = installConfigPath(projectRoot);
  if (!existsSync(path)) return null;
  return readJsonFile<InstallConfig>(path);
}

export function writeInstallConfig(projectRoot: string, config: InstallConfig): void {
  writeFileSync(installConfigPath(projectRoot), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function inferInstallConfig(projectRoot: string): InstallConfig | null {
  const pkgPath = join(projectRoot, 'package.json');
  let projectName = projectRoot.split(/[/\\]/).pop() ?? 'project';

  if (existsSync(pkgPath)) {
    const pkg = readJsonFile<{ name?: string }>(pkgPath);
    if (pkg.name) projectName = pkg.name;
  }

  let wikiDir = 'wiki';
  const agentsPath = join(projectRoot, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const agents = readFileSync(agentsPath, 'utf8');
    const wikiLink = agents.match(/\[`([^/`]+)\/AGENTS\.md`\]/);
    if (wikiLink) wikiDir = wikiLink[1];
  }

  const schemaPath = join(projectRoot, wikiDir, 'schema.md');
  if (!existsSync(schemaPath) && !existsSync(agentsPath)) return null;

  return {
    version: '0.0.0',
    projectName,
    wikiDir,
    focusDirs: [],
  };
}

function writeInterpolatedFile(src: string, dest: string, vars: Record<string, string>): void {
  mkdirSync(dirname(dest), { recursive: true });
  const name = src.split(/[/\\]/).pop() ?? '';
  const raw = readFileSync(src, 'utf8');
  const content = shouldInterpolateFile(name) ? interpolate(raw, vars) : raw;
  writeFileSync(dest, content, 'utf8');
}

function walkTemplateFiles(dir: string, base = dir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkTemplateFiles(full, base));
    } else {
      results.push(relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

function shouldCopyWikiPath(relPath: string, overwrite: boolean, wikiDest: string): boolean {
  const dest = join(wikiDest, relPath);
  if (overwrite) {
    if (relPath === 'index.md' || relPath === 'log.md') return false;
    return (
      (WIKI_META_UPGRADE_PATHS as readonly string[]).includes(relPath) ||
      relPath.startsWith('.obsidian/')
    );
  }
  if ((WIKI_INIT_ONLY_PATHS as readonly string[]).includes(relPath)) {
    return !existsSync(dest);
  }
  if ((WIKI_META_UPGRADE_PATHS as readonly string[]).includes(relPath)) {
    return !existsSync(dest);
  }
  if (relPath.startsWith('.obsidian/')) {
    return !existsSync(dest);
  }
  return false;
}

export function scaffoldWikiTemplates(
  wikiDest: string,
  vars: Record<string, string>,
  options: { overwrite?: boolean; dryRun?: boolean } = {},
): CopyTemplateResult {
  const overwrite = options.overwrite ?? false;
  const dryRun = options.dryRun ?? false;
  const srcRoot = templatePath('wiki');
  const result: CopyTemplateResult = { created: [], skipped: [], updated: [] };

  for (const relPath of walkTemplateFiles(srcRoot)) {
    if (!shouldCopyWikiPath(relPath, overwrite, wikiDest)) {
      result.skipped.push(relPath);
      continue;
    }

    const src = join(srcRoot, relPath);
    const dest = join(wikiDest, relPath);
    const existed = existsSync(dest);

    if (dryRun) {
      if (existed) result.updated.push(relPath);
      else result.created.push(relPath);
      continue;
    }

    writeInterpolatedFile(src, dest, vars);
    if (existed) result.updated.push(relPath);
    else result.created.push(relPath);
  }

  return result;
}

/** Derive a flat entity scope slug from a focus directory path (e.g. src/ui/_app/ → app). */
export function scopeSlugFromFocusDir(focusDir: string): string {
  const normalized = focusDir.replace(/\\/g, '/').replace(/\/$/, '');
  const base = normalized.split('/').pop() ?? normalized;
  return base.replace(/^_/, '');
}

export function entityOverviewStub(
  slug: string,
  sourcePath: string,
  initTimestamp: string,
): string {
  const title = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const normalizedPath = sourcePath.replace(/\\/g, '/').replace(/\/$/, '');
  return `---
type: overview
title: ${title}
last_updated: ${initTimestamp}
tags: [${slug}]
related: []
status: wip
summary: Overview stub for \`${normalizedPath}/\` — expand through day-to-day work.
---

# ${title} (\`${normalizedPath}/\`)

> Stub entity overview. The first tag (\`${slug}\`) is the scope slug. Add content as you work in this area.

`;
}

export const WIKI_EMPTY_DIRS = [
  'concepts',
  'sources',
  'entities',
  'archive',
  'raw/articles',
  'raw/prs',
  'raw/tickets',
  'raw/design-notes',
  'raw/transcripts',
  'raw/assets',
] as const;

export function scaffoldWikiEmptyDirs(wikiDest: string): void {
  for (const sub of WIKI_EMPTY_DIRS) {
    mkdirSync(join(wikiDest, sub), { recursive: true });
    const keep = join(wikiDest, sub, '.gitkeep');
    if (!existsSync(keep)) writeFileSync(keep, '');
  }
}

export function scaffoldEntityOverviews(
  wikiDest: string,
  focusDirs: string[],
  initTimestamp: string,
): string[] {
  mkdirSync(join(wikiDest, 'entities'), { recursive: true });
  const slugs: string[] = [];
  for (const focusDir of focusDirs) {
    const slug = scopeSlugFromFocusDir(focusDir);
    slugs.push(slug);
    const entityPath = join(wikiDest, 'entities', `${slug}.md`);
    if (!existsSync(entityPath)) {
      writeFileSync(entityPath, entityOverviewStub(slug, focusDir, initTimestamp));
    }
  }
  return slugs;
}

export const WIKI_SCRIPT_KEYS = [
  'wiki:help',
  'wiki:lint',
  'wiki:build',
  'wiki:check',
  'wiki:sync',
  'wiki:log',
  'wiki:setup:husky',
] as const;

export type WikiScriptKey = (typeof WIKI_SCRIPT_KEYS)[number];

export function wikiScriptCandidates(): Record<WikiScriptKey, string> {
  return {
    'wiki:help': 'llm-wiki-manager help',
    'wiki:lint': 'llm-wiki-manager lint',
    'wiki:build': 'llm-wiki-manager build',
    'wiki:check': 'llm-wiki-manager check',
    'wiki:sync': 'llm-wiki-manager sync',
    'wiki:log': 'llm-wiki-manager log',
    'wiki:setup:husky': 'llm-wiki-manager setup-husky',
  };
}

export type MergePackageJsonResult =
  { status: 'no-package-json' } | { status: 'merged'; added: string[] } | { status: 'unchanged' };

export type MergeDevDependencyResult =
  { status: 'no-package-json' } | { status: 'merged'; version: string } | { status: 'unchanged' };

export function packageBinPath(projectRoot: string, packageName = PACKAGE_NAME): string {
  return join(projectRoot, 'node_modules', '.bin', packageName);
}

export function isPackageBinInstalled(projectRoot: string, packageName = PACKAGE_NAME): boolean {
  const binPath = packageBinPath(projectRoot, packageName);
  return existsSync(binPath) || existsSync(`${binPath}.cmd`);
}

export function hasWikiScripts(scripts: Record<string, string> | undefined): boolean {
  if (!scripts) return false;
  return WIKI_SCRIPT_KEYS.some((key) => key in scripts);
}

export function mergePackageJsonDevDependency(
  projectRoot: string,
  version: string = getPackageVersion(),
): MergeDevDependencyResult {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return { status: 'no-package-json' };

  const pkg = readJsonFile<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(pkgPath);

  if (pkg.dependencies?.[PACKAGE_NAME] || pkg.devDependencies?.[PACKAGE_NAME]) {
    return { status: 'unchanged' };
  }

  if (!pkg.devDependencies) pkg.devDependencies = {};
  pkg.devDependencies[PACKAGE_NAME] = `^${version}`;

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return { status: 'merged', version };
}

export function syncPackageJsonDevDependency(
  projectRoot: string,
  version: string = getPackageVersion(),
): MergeDevDependencyResult {
  return mergePackageJsonDevDependency(projectRoot, version);
}

export function mergePackageJsonScripts(projectRoot: string): MergePackageJsonResult {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return { status: 'no-package-json' };

  const pkg = readJsonFile<{ scripts?: Record<string, string> }>(pkgPath);
  if (!pkg.scripts) pkg.scripts = {};

  const candidates = wikiScriptCandidates();

  const added: string[] = [];
  for (const key of WIKI_SCRIPT_KEYS) {
    if (!(key in pkg.scripts)) {
      pkg.scripts[key] = candidates[key];
      added.push(key);
    }
  }

  if (added.length === 0) return { status: 'unchanged' };

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return { status: 'merged', added };
}

function stripManagedMarkers(section: string): string {
  let body = section.trim();
  if (body.startsWith(MANAGED_SECTION_DELIMITER)) {
    body = body.slice(MANAGED_SECTION_DELIMITER.length).trim();
  }
  if (body.endsWith(MANAGED_SECTION_END)) {
    body = body.slice(0, -MANAGED_SECTION_END.length).trim();
  }
  return body;
}

function stripLeadingManagedEndMarkers(text: string): string {
  let result = text;
  while (true) {
    const trimmed = result.trimStart();
    if (!trimmed.startsWith(MANAGED_SECTION_END)) break;
    result = trimmed.slice(MANAGED_SECTION_END.length);
  }
  return result;
}

function findManagedSectionEnd(text: string, fromIndex: number): number {
  let inFence = false;
  let position = fromIndex;

  while (position < text.length) {
    const newline = text.indexOf('\n', position);
    const lineEnd = newline >= 0 ? newline + 1 : text.length;
    const line = text.slice(position, lineEnd);
    const lineWithoutEol = line.replace(/\r?\n$/, '');
    const isFence = /^\s*(```|~~~)/.test(lineWithoutEol);

    if (!inFence && lineWithoutEol.trim() === MANAGED_SECTION_END) {
      return position + line.indexOf(MANAGED_SECTION_END);
    }

    if (isFence) inFence = !inFence;
    position = lineEnd;
  }

  return -1;
}

function managedBlock(section: string): string {
  return `${MANAGED_SECTION_DELIMITER}\n${stripManagedMarkers(section)}\n${MANAGED_SECTION_END}`;
}

export function amendFile(filePath: string, section: string): boolean {
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing.includes(MANAGED_SECTION_DELIMITER)) return false; // already amended
    // Downgrade top-level heading to second-level when appending
    const appendSection = section.replace(/^# /m, '## ');
    writeFileSync(filePath, `${existing.trimEnd()}\n\n${managedBlock(appendSection)}\n`, 'utf8');
  } else {
    writeFileSync(filePath, `${managedBlock(section)}\n`, 'utf8');
  }
  return true;
}

export function replaceManagedSection(filePath: string, section: string): boolean {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${managedBlock(section)}\n`, 'utf8');
    return true;
  }

  const existing = readFileSync(filePath, 'utf8');
  const start = existing.indexOf(MANAGED_SECTION_DELIMITER);
  if (start < 0) return false;

  const afterDelimiter = start + MANAGED_SECTION_DELIMITER.length;
  const endIdx = findManagedSectionEnd(existing, afterDelimiter);

  let afterSection: string;
  if (endIdx >= 0) {
    afterSection = stripLeadingManagedEndMarkers(
      existing.slice(endIdx + MANAGED_SECTION_END.length),
    );
  } else {
    // Legacy blocks had no end marker. Preserve an unbounded tail rather than
    // risk deleting user-authored notes appended after the generated section.
    afterSection = existing.slice(afterDelimiter);
  }

  const before = existing.slice(0, start).trimEnd();
  const after = afterSection.trim();
  const out = [before, managedBlock(section), after].filter(Boolean).join('\n\n');
  writeFileSync(filePath, `${out}\n`, 'utf8');
  return true;
}

export type SyncPackageJsonResult =
  | { status: 'no-package-json' }
  | { status: 'synced'; added: string[]; updated: string[] }
  | { status: 'unchanged' };

export function syncPackageJsonScripts(projectRoot: string): SyncPackageJsonResult {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return { status: 'no-package-json' };

  const pkg = readJsonFile<{ scripts?: Record<string, string> }>(pkgPath);
  if (!pkg.scripts) pkg.scripts = {};

  const candidates = wikiScriptCandidates();
  const added: string[] = [];
  const updated: string[] = [];

  for (const key of WIKI_SCRIPT_KEYS) {
    if (!(key in pkg.scripts)) {
      pkg.scripts[key] = candidates[key];
      added.push(key);
    } else if (pkg.scripts[key] !== candidates[key]) {
      pkg.scripts[key] = candidates[key];
      updated.push(key);
    }
  }

  if (added.length === 0 && updated.length === 0) return { status: 'unchanged' };

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return { status: 'synced', added, updated };
}

export function isExistingInstall(projectRoot: string, wikiDir: string): boolean {
  return (
    existsSync(installConfigPath(projectRoot)) ||
    existsSync(join(projectRoot, wikiDir, 'schema.md'))
  );
}
