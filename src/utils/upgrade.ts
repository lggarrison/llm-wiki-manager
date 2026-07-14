import { resolve } from 'path';
import type { InstallConfig } from './fs.js';
import {
  buildTemplateVars,
  ensureWikiLog,
  scaffoldWikiEmptyDirs,
  scaffoldEntityOverviews,
  scaffoldWikiTemplates,
} from './fs.js';
import { resolveWikiContext } from '../wiki/context.js';
import { runMigrate } from '../wiki/migrate-pages.js';
import { runSync } from '../wiki/sync-see-also.js';
import { runBuild } from '../wiki/build-index.js';
import { runLint } from '../wiki/lint.js';
import { runLog } from '../wiki/log.js';

export type UpgradeOptions = {
  dryRun?: boolean;
  skipPages?: boolean;
};

export type UpgradeStepResult = {
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
    focusDirs: config.focusDirs,
  });

  const wikiDest = resolve(projectRoot, config.wikiDir);
  const dryRun = options.dryRun ?? false;

  const wikiMeta = scaffoldWikiTemplates(wikiDest, vars, { overwrite: true, dryRun });

  if (!dryRun) {
    scaffoldWikiEmptyDirs(wikiDest);
    if (config.focusDirs.length > 0) {
      scaffoldEntityOverviews(wikiDest, config.focusDirs, vars.INIT_TIMESTAMP);
    }
  }

  return { wikiMeta };
}

export async function runPostUpgradeScripts(
  projectRoot: string,
  config: InstallConfig,
  options: { skipPages?: boolean } = {},
): Promise<void> {
  const ctx = resolveWikiContext({
    cwd: projectRoot,
    wikiDir: config.wikiDir,
  });

  if (!options.skipPages) {
    const migrateStatus = runMigrate(ctx);
    if (migrateStatus !== 0) {
      throw new Error('migrate-pages failed');
    }
  }

  const syncStatus = runSync(ctx);
  if (syncStatus !== 0) throw new Error('sync-see-also failed');

  const buildStatus = await runBuild(ctx);
  if (buildStatus !== 0) throw new Error('build-index failed');

  const lintStatus = runLint(ctx, { warnOnly: true });
  if (lintStatus !== 0) throw new Error('lint failed');
}

export function appendUpgradeLog(
  projectRoot: string,
  config: InstallConfig,
  version: string,
): void {
  const vars = buildTemplateVars({
    projectName: config.projectName,
    wikiDir: config.wikiDir,
    focusDirs: config.focusDirs,
  });
  ensureWikiLog(resolve(projectRoot, config.wikiDir), vars);

  const ctx = resolveWikiContext({
    cwd: projectRoot,
    wikiDir: config.wikiDir,
  });
  const status = runLog(ctx, ['add', 'maintenance', `Upgraded llm-wiki-manager to v${version}`]);
  if (status !== 0) {
    throw new Error('log failed');
  }
}
