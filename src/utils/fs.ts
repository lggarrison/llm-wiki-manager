import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

function walkAndInterpolate(dir: string, vars: Record<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkAndInterpolate(full, vars);
    } else if (/\.(md|mjs|js)$/.test(full)) {
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

export const WIKI_SCRIPT_KEYS = [
  'wiki:help',
  'wiki:lint',
  'wiki:build',
  'wiki:check',
  'wiki:sync',
  'wiki:log',
] as const;

export type WikiScriptKey = (typeof WIKI_SCRIPT_KEYS)[number];

export const WIKI_TEMPLATE_SCRIPTS = [
  'help.mjs',
  'lint.mjs',
  'build-index.mjs',
  'sync-see-also.mjs',
  'log.mjs',
] as const;

export function wikiScriptCandidates(scriptsDir: string): Record<WikiScriptKey, string> {
  return {
    'wiki:help': `node ${scriptsDir}/help.mjs`,
    'wiki:lint': `node ${scriptsDir}/lint.mjs`,
    'wiki:build': `node ${scriptsDir}/build-index.mjs`,
    'wiki:check': `node ${scriptsDir}/build-index.mjs --check`,
    'wiki:sync': `node ${scriptsDir}/sync-see-also.mjs`,
    'wiki:log': `node ${scriptsDir}/log.mjs`,
  };
}

export type MergePackageJsonResult =
  { status: 'no-package-json' } | { status: 'merged'; added: string[] } | { status: 'unchanged' };

export function mergePackageJsonScripts(
  projectRoot: string,
  scriptsDir: string,
): MergePackageJsonResult {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return { status: 'no-package-json' };

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  if (!pkg.scripts) pkg.scripts = {};

  const candidates = wikiScriptCandidates(scriptsDir);

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

export function amendFile(filePath: string, section: string): boolean {
  const delimiter = '<!-- llm-wiki-manager -->';
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing.includes(delimiter)) return false; // already amended
    // Downgrade top-level heading to second-level when appending
    const appendSection = section.replace(/^# /m, '## ');
    writeFileSync(filePath, `${existing.trimEnd()}\n\n${delimiter}\n${appendSection}\n`, 'utf8');
  } else {
    writeFileSync(filePath, `${delimiter}\n${section}\n`, 'utf8');
  }
  return true;
}
