import { intro, outro, log } from '@clack/prompts';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import {
  templatePath,
  interpolate,
  readInstallConfig,
  writeInstallConfig,
  inferInstallConfig,
  getPackageVersion,
  replaceManagedSection,
  amendFile,
  syncPackageJsonScripts,
  MANAGED_SECTION_DELIMITER,
} from '../utils/fs.js';
import {
  runUpgradeSteps,
  runPostUpgradeScripts,
  appendUpgradeLog,
  type UpgradeOptions,
} from '../utils/upgrade.js';

function parseUpgradeArgs(argv: string[]): UpgradeOptions {
  return {
    dryRun: argv.includes('--dry-run'),
    skipPages: argv.includes('--skip-pages'),
  };
}

export async function upgrade(): Promise<void> {
  const options = parseUpgradeArgs(process.argv.slice(3));
  intro(pc.cyan('llm-wiki-manager — upgrade'));

  const cwd = process.cwd();
  const packageVersion = getPackageVersion();
  let config = readInstallConfig(cwd);

  if (!config) {
    config = inferInstallConfig(cwd);
    if (!config) {
      throw new Error(
        'Could not find .llm-wiki-manager.json or infer install paths. Run init first.',
      );
    }
    log.warn('No install config found — inferred paths from existing files.');
  }

  const fromVersion = config.version;
  log.info(`Upgrading scaffold ${pc.bold(fromVersion)} → ${pc.bold(packageVersion)}`);

  if (options.dryRun) {
    log.warn('Dry run — no files will be modified.');
  }

  const { wikiMeta } = runUpgradeSteps(cwd, config, options);

  if (wikiMeta.created.length + wikiMeta.updated.length > 0) {
    log.step(
      `Wiki meta: ${wikiMeta.created.length} created, ${wikiMeta.updated.length} updated, ${wikiMeta.skipped.length} skipped`,
    );
  }

  if (!options.dryRun) {
    log.step('Refreshing root AGENTS.md…');
    const agentsTemplate = readFileSync(templatePath('AGENTS.md'), 'utf8');
    const agentsContent = interpolate(agentsTemplate, {
      PROJECT_NAME: config.projectName,
      WIKI_DIR: config.wikiDir,
    });
    const agentsDest = resolve(cwd, 'AGENTS.md');
    const agentsExisting = existsSync(agentsDest) ? readFileSync(agentsDest, 'utf8') : '';
    if (agentsExisting.includes(MANAGED_SECTION_DELIMITER)) {
      replaceManagedSection(agentsDest, agentsContent);
    } else {
      amendFile(agentsDest, agentsContent);
    }

    const pkgResult = syncPackageJsonScripts(cwd);
    if (pkgResult.status === 'synced') {
      const changes = [...pkgResult.added, ...pkgResult.updated.map((k) => `${k} (updated)`)];
      log.step(`Synced package.json wiki scripts (${changes.join(', ')})…`);
    }

    if (!options.skipPages) {
      log.step('Migrating pages and running post-upgrade scripts…');
      runPostUpgradeScripts(cwd, config, { skipPages: false });
    } else {
      log.step('Running sync, build, and lint…');
      runPostUpgradeScripts(cwd, config, { skipPages: true });
    }

    appendUpgradeLog(cwd, config, packageVersion);

    writeInstallConfig(cwd, { ...config, version: packageVersion });
  }

  outro(
    options.dryRun
      ? pc.yellow('Dry run complete — no changes written.')
      : pc.green('Upgrade complete!') +
          `\n  • Run ${pc.bold('npm run wiki:lint')} to review any remaining issues\n` +
          `  • See ${pc.bold(join(config.wikiDir, 'AGENTS.md'))} for updated agent instructions`,
  );
}
