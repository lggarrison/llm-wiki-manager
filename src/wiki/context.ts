import { resolve } from 'path';
import { inferWikiDirFromAgents, readInstallConfig } from '../utils/fs.js';

export type WikiContext = {
  cwd: string;
  wikiDir: string;
  repoRoot: string;
};

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
  const cwd = options.cwd ?? process.cwd();
  const repoRoot = resolve(options.repoRoot ?? cwd);
  const wikiDir = resolveWikiDir(cwd, options.wikiDir);
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
