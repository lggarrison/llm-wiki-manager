import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import type { InstallConfig } from './fs.js';
import {
  buildTemplateVars,
  scaffoldWikiEmptyDirs,
  scaffoldEntityOverviews,
  scaffoldWikiTemplates,
  upgradeScripts,
} from './fs.js';

export type UpgradeOptions = {
  dryRun?: boolean;
  skipScripts?: boolean;
  skipPages?: boolean;
};

export type UpgradeStepResult = {
  scripts: ReturnType<typeof upgradeScripts>;
  wikiMeta: ReturnType<typeof scaffoldWikiTemplates>;
};

export function runUpgradeSteps(
  projectRoot: string,
  config: InstallConfig,
  options: UpgradeOptions = {},
): UpgradeStepResult {
  const vars = buildTemplateVars({
    projectName: config.projectName,
    wikiDir: config.wikiDir,
    scriptsDir: config.scriptsDir,
    focusDirs: config.focusDirs,
  });

  const wikiDest = resolve(projectRoot, config.wikiDir);
  const scriptsDest = resolve(projectRoot, config.scriptsDir);
  const dryRun = options.dryRun ?? false;

  const scripts = options.skipScripts
    ? { created: [], skipped: [], updated: [] }
    : upgradeScripts(scriptsDest, vars, { dryRun });

  const wikiMeta = scaffoldWikiTemplates(wikiDest, vars, { overwrite: true, dryRun });

  if (!dryRun) {
    scaffoldWikiEmptyDirs(wikiDest);
    if (config.focusDirs.length > 0) {
      scaffoldEntityOverviews(wikiDest, config.focusDirs, vars.INIT_TIMESTAMP);
    }
  }

  return { scripts, wikiMeta };
}

export function runWikiScript(
  projectRoot: string,
  scriptsDir: string,
  scriptName: string,
  args: string[] = [],
): number {
  const scriptPath = join(projectRoot, scriptsDir, scriptName);
  if (!existsSync(scriptPath)) {
    throw new Error(`Wiki script not found: ${scriptPath}`);
  }
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  return result.status ?? 1;
}

export function runPostUpgradeScripts(
  projectRoot: string,
  config: InstallConfig,
  options: { skipPages?: boolean } = {},
): void {
  const { wikiDir, scriptsDir } = config;

  if (!options.skipPages) {
    const migrateStatus = runWikiScript(projectRoot, scriptsDir, 'migrate-pages.mjs', [
      '--wiki-dir',
      wikiDir,
    ]);
    if (migrateStatus !== 0) {
      throw new Error('migrate-pages.mjs failed');
    }
  }

  const syncStatus = runWikiScript(projectRoot, scriptsDir, 'sync-see-also.mjs', [
    '--wiki-dir',
    wikiDir,
  ]);
  if (syncStatus !== 0) throw new Error('sync-see-also.mjs failed');

  const buildStatus = runWikiScript(projectRoot, scriptsDir, 'build-index.mjs', [
    '--wiki-dir',
    wikiDir,
  ]);
  if (buildStatus !== 0) throw new Error('build-index.mjs failed');

  const lintStatus = runWikiScript(projectRoot, scriptsDir, 'lint.mjs', [
    '--wiki-dir',
    wikiDir,
    '--repo-root',
    projectRoot,
    '--warn-only',
  ]);
  if (lintStatus !== 0) throw new Error('lint.mjs failed');
}

export function appendUpgradeLog(
  projectRoot: string,
  config: InstallConfig,
  version: string,
): void {
  runWikiScript(projectRoot, config.scriptsDir, 'log.mjs', [
    'add',
    'maintenance',
    `Upgraded llm-wiki-manager to v${version}`,
    '--wiki-dir',
    config.wikiDir,
  ]);
}
