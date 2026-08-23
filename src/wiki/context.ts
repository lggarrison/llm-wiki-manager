import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { findInstallRoot, readInstallConfig } from '../utils/fs.js';

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

export function resolveWikiDir(projectRoot: string, wikiDirFlag?: string): string {
  if (wikiDirFlag) {
    return resolve(projectRoot, wikiDirFlag);
  }
  const config = readInstallConfig(projectRoot);
  if (config?.wikiDir) {
    return resolve(projectRoot, config.wikiDir);
  }
  const inferred = inferWikiDirFromAgents(projectRoot);
  if (inferred) {
    return resolve(projectRoot, inferred);
  }
  return resolve(projectRoot, 'wiki');
}

export function resolveWikiContext(
  options: {
    cwd?: string;
    wikiDir?: string;
    repoRoot?: string;
  } = {},
): WikiContext {
  const cwd = resolve(options.cwd ?? process.cwd());
  const repoRoot = options.repoRoot
    ? resolve(cwd, options.repoRoot)
    : (findInstallRoot(cwd) ?? cwd);
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
