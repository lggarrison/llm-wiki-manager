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
  syncPackageJsonDevDependency,
  getPackageInstallStatus,
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

  const hasPackageJson = existsSync(join(cwd, 'package.json'));
  const installStatus = hasPackageJson ? getPackageInstallStatus(cwd, packageVersion) : null;
  if (installStatus?.reason === 'ahead') {
    throw new Error(
      `Local ${pc.bold('llm-wiki-manager')} install is v${installStatus.installedVersion}, ` +
        `but this upgrade command is v${installStatus.targetVersion}. ` +
        `Run ${pc.bold('npm exec llm-wiki-manager -- upgrade')} or ` +
        `${pc.bold('npx llm-wiki-manager@latest upgrade')} so newer wiki templates are not overwritten by an older CLI.`,
    );
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
    const depResult = syncPackageJsonDevDependency(cwd);
    if (pkgResult.status === 'synced') {
      const changes = [...pkgResult.added, ...pkgResult.updated.map((k) => `${k} (updated)`)];
      log.step(`Synced package.json wiki scripts (${changes.join(', ')})…`);
    } else if (depResult.status === 'merged') {
      log.step(`Added ${pc.bold('llm-wiki-manager')} to devDependencies…`);
    } else if (depResult.status === 'updated') {
      log.step(
        `Updated ${pc.bold('llm-wiki-manager')} devDependency (${depResult.previous} → ^${depResult.version})…`,
      );
    }

    if (!options.skipPages) {
      log.step('Migrating pages and running post-upgrade scripts…');
      await runPostUpgradeScripts(cwd, config, { skipPages: false });
    } else {
      log.step('Running sync, build, and lint…');
      await runPostUpgradeScripts(cwd, config, { skipPages: true });
    }

    appendUpgradeLog(cwd, config, packageVersion);

    writeInstallConfig(cwd, { ...config, version: packageVersion });

    outro(
      pc.green('Upgrade complete!') +
        (installStatus?.needsInstall
          ? installStatus.reason === 'stale'
            ? `\n  ${pc.yellow('Final Step:')} ${pc.bold('npm install')} — local install is v${installStatus.installedVersion} but upgrade used v${installStatus.targetVersion}\n`
            : `\n  ${pc.yellow('Final Step:')} ${pc.bold('npm install')} — required before ${pc.bold('npm run wiki:*')} works\n`
          : '') +
        `\n  • Run ${pc.bold('npm run wiki:lint')} to review any remaining issues\n` +
        `  • See ${pc.bold(join(config.wikiDir, 'AGENTS.md'))} for updated agent instructions`,
    );
  } else {
    outro(pc.yellow('Dry run complete — no changes written.'));
  }
}
