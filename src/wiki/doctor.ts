import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import {
  INSTALL_CONFIG_FILENAME,
  WIKI_SCRIPT_KEYS,
  getPackageVersion,
  getInstalledPackageVersion,
  compareVersions,
  hasWikiScripts,
  inferInstallConfig,
  isPackageBinInstalled,
  readInstallConfig,
  readJsonFile,
  wikiScriptCandidates,
  findInstallRoot,
  hasManagedSection,
} from '../utils/fs.js';
import type { InstallConfig } from '../utils/fs.js';
import { isIndexStale } from './build-index.js';

const WIKI_META_FILES = ['schema.md', 'AGENTS.md', 'README.md', 'index.md', 'log.md'];

type Report = {
  ok: string[];
  problems: string[];
};

function readConfig(cwd: string, report: Report): InstallConfig | null {
  let config: InstallConfig | null;
  try {
    config = readInstallConfig(cwd);
  } catch {
    report.problems.push(
      `${INSTALL_CONFIG_FILENAME} exists but could not be parsed — fix or delete it, then re-run init`,
    );
    return null;
  }

  if (config) {
    report.ok.push(`install config found (${INSTALL_CONFIG_FILENAME})`);
    return config;
  }

  config = inferInstallConfig(cwd);
  if (config) {
    report.problems.push(
      `no ${INSTALL_CONFIG_FILENAME} found (paths inferred from existing files) — run init to record install metadata`,
    );
    return config;
  }

  report.problems.push(
    `no ${INSTALL_CONFIG_FILENAME} and no wiki detected — run npx llm-wiki-manager init`,
  );
  return null;
}

export async function runDoctor(cwd: string = process.cwd()): Promise<number> {
  const projectRoot = findInstallRoot(cwd) ?? cwd;
  const report: Report = { ok: [], problems: [] };
  const packageVersion = getPackageVersion();

  console.log(`llm-wiki-manager doctor — v${packageVersion}\n`);

  const config = readConfig(projectRoot, report);

  if (config) {
    const installedVersion = getInstalledPackageVersion(projectRoot);
    if (installedVersion && installedVersion !== config.version) {
      if (compareVersions(installedVersion, config.version) > 0) {
        report.problems.push(
          `scaffold is v${config.version} but node_modules has v${installedVersion} — run npx llm-wiki-manager upgrade`,
        );
      } else {
        report.problems.push(
          `scaffold is v${config.version} but node_modules has v${installedVersion} — run npm install`,
        );
      }
    } else if (config.version === packageVersion) {
      report.ok.push(`scaffold version matches package (v${packageVersion})`);
    } else {
      report.problems.push(
        `scaffold is v${config.version}, package is v${packageVersion} — run npx llm-wiki-manager upgrade`,
      );
    }

    const wikiDir = resolve(projectRoot, config.wikiDir);
    if (!existsSync(wikiDir)) {
      report.problems.push(`wiki directory missing: ${config.wikiDir}/ — run init`);
    } else {
      const missing = WIKI_META_FILES.filter((f) => !existsSync(join(wikiDir, f)));
      if (missing.length === 0) {
        report.ok.push(`wiki meta files present in ${config.wikiDir}/`);
      } else {
        report.problems.push(
          `missing wiki meta file(s) in ${config.wikiDir}/: ${missing.join(', ')} — run init or upgrade`,
        );
      }

      if (existsSync(join(wikiDir, 'index.md'))) {
        if (await isIndexStale(wikiDir, projectRoot)) {
          report.problems.push('index.md is stale — run npm run wiki:build');
        } else {
          report.ok.push('index.md is up to date');
        }
      }
    }

    const agentsPath = join(projectRoot, 'AGENTS.md');
    if (!existsSync(agentsPath)) {
      report.problems.push('root AGENTS.md missing — run init');
    } else if (!hasManagedSection(readFileSync(agentsPath, 'utf8'))) {
      report.problems.push(
        'root AGENTS.md has no llm-wiki-manager managed section — run upgrade to add it',
      );
    } else {
      report.ok.push('root AGENTS.md has the managed section');
    }

    const pkgPath = join(projectRoot, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = readJsonFile<{ scripts?: Record<string, string> }>(pkgPath);
        const scripts = pkg.scripts ?? {};
        const candidates = wikiScriptCandidates();
        const outdated = WIKI_SCRIPT_KEYS.filter((key) => scripts[key] !== candidates[key]);
        if (outdated.length === 0) {
          report.ok.push('package.json wiki:* scripts are in sync');
        } else {
          report.problems.push(
            `package.json wiki script(s) missing or outdated: ${outdated.join(', ')} — run upgrade to sync`,
          );
        }

        if (hasWikiScripts(scripts) && !isPackageBinInstalled(projectRoot)) {
          report.problems.push(
            'llm-wiki-manager is not installed locally — run npm install, then npm run wiki:* (not npx run wiki:*); or use npx llm-wiki-manager <command> before installing',
          );
        }
      } catch {
        report.problems.push('package.json could not be parsed');
      }
    }
  }

  for (const line of report.ok) {
    console.log(`  ${pc.green('✓')} ${line}`);
  }
  for (const line of report.problems) {
    console.log(`  ${pc.red('✗')} ${line}`);
  }

  console.log('');
  if (report.problems.length > 0) {
    console.log(pc.red(`${report.problems.length} problem(s) found.`));
    return 1;
  }
  console.log(pc.green('No problems found.'));
  return 0;
}
