import { existsSync, readFileSync } from 'fs';
import { isAbsolute, join, normalize, relative, resolve } from 'path';
import { readInstallConfig } from '../utils/fs.js';

export type WikiContext = {
  cwd: string;
  wikiDir: string;
  repoRoot: string;
};

function inferWikiDirFromAgents(projectRoot: string): string | null {
  const agentsPath = join(projectRoot, 'AGENTS.md');
  if (!existsSync(agentsPath)) return null;
  const agents = readFileSync(agentsPath, 'utf8');
  const wikiLink = agents.match(/\[`([^/`]+)\/AGENTS\.md`\]/);
  return wikiLink ? wikiLink[1] : null;
}

function wikiDirError(wikiDir: string): Error {
  return new Error(
    `Unsafe wiki directory "${wikiDir}". Use a relative child directory such as "wiki" or "docs/wiki".`,
  );
}

export function normalizeWikiDir(wikiDir: string): string {
  const trimmed = wikiDir.trim();
  if (!trimmed || isAbsolute(trimmed)) {
    throw wikiDirError(wikiDir);
  }

  const segments = trimmed.split(/[\\/]+/).filter(Boolean);
  if (segments.includes('..')) {
    throw wikiDirError(wikiDir);
  }

  const normalized = normalize(trimmed).replace(/\\/g, '/');
  if (!normalized || normalized === '.') {
    throw wikiDirError(wikiDir);
  }

  return normalized;
}

export function resolveSafeWikiDir(projectRoot: string, wikiDir: string): string {
  const root = resolve(projectRoot);
  const normalized = normalizeWikiDir(wikiDir);
  const resolved = resolve(root, normalized);
  const rel = relative(root, resolved);

  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw wikiDirError(wikiDir);
  }

  return resolved;
}

export function resolveWikiDir(projectRoot: string, wikiDirFlag?: string): string {
  if (wikiDirFlag) {
    return resolveSafeWikiDir(projectRoot, wikiDirFlag);
  }
  const config = readInstallConfig(projectRoot);
  if (config?.wikiDir) {
    return resolveSafeWikiDir(projectRoot, config.wikiDir);
  }
  const inferred = inferWikiDirFromAgents(projectRoot);
  if (inferred) {
    return resolveSafeWikiDir(projectRoot, inferred);
  }
  return resolveSafeWikiDir(projectRoot, 'wiki');
}

export function resolveWikiContext(
  options: {
    cwd?: string;
    wikiDir?: string;
    repoRoot?: string;
  } = {},
): WikiContext {
  const cwd = options.cwd ?? process.cwd();
  const repoRoot = resolve(options.repoRoot ?? cwd);
  const wikiDir = resolveWikiDir(repoRoot, options.wikiDir);
  return { cwd, wikiDir, repoRoot };
}

export function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

export function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}
