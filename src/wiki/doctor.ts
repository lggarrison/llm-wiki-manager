import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import {
  INSTALL_CONFIG_FILENAME,
  MANAGED_SECTION_DELIMITER,
  WIKI_SCRIPT_KEYS,
  PACKAGE_NAME,
  getPackageVersion,
  getInstalledPackageVersion,
  compareVersions,
  hasWikiScripts,
  inferInstallConfig,
  isPackageBinInstalled,
  readInstallConfig,
  readJsonFile,
  wikiScriptCandidates,
} from '../utils/fs.js';
import type { InstallConfig } from '../utils/fs.js';
import { isIndexStale } from './build-index.js';

const WIKI_META_FILES = ['schema.md', 'AGENTS.md', 'README.md', 'index.md', 'log.md'];

type Report = {
  ok: string[];
  problems: string[];
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Semver = {
  major: number;
  minor: number;
  patch: number;
};

function parseSemver(value: string): Semver | null {
  const match = value.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1] ?? '0', 10),
    minor: Number.parseInt(match[2] ?? '0', 10),
    patch: Number.parseInt(match[3] ?? '0', 10),
  };
}

function semverString(version: Semver): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function caretUpperBound(version: Semver): Semver {
  if (version.major > 0) return { major: version.major + 1, minor: 0, patch: 0 };
  if (version.minor > 0) return { major: 0, minor: version.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: version.patch + 1 };
}

function tildeUpperBound(version: Semver): Semver {
  return { major: version.major, minor: version.minor + 1, patch: 0 };
}

function dependencySpecIsDefinitelyTooOld(spec: string, targetVersion: string): boolean {
  const target = parseSemver(targetVersion);
  if (!target) return false;
  const targetText = semverString(target);
  const normalized = spec.trim();

  if (/^v?\d+\.\d+\.\d+$/.test(normalized)) {
    const pinned = parseSemver(normalized);
    return Boolean(pinned && compareVersions(semverString(pinned), targetText) < 0);
  }

  const caret = normalized.match(/^\^\s*(v?\d+\.\d+\.\d+)/);
  if (caret?.[1]) {
    const base = parseSemver(caret[1]);
    if (!base || compareVersions(semverString(base), targetText) > 0) return false;
    return compareVersions(targetText, semverString(caretUpperBound(base))) >= 0;
  }

  const tilde = normalized.match(/^~\s*(v?\d+\.\d+\.\d+)/);
  if (tilde?.[1]) {
    const base = parseSemver(tilde[1]);
    if (!base || compareVersions(semverString(base), targetText) > 0) return false;
    return compareVersions(targetText, semverString(tildeUpperBound(base))) >= 0;
  }

  for (const match of normalized.matchAll(/(<)(=)?\s*v?(\d+\.\d+\.\d+)/g)) {
    const upper = match[3];
    if (!upper) continue;
    const comparison = compareVersions(targetText, upper);
    if (match[2] ? comparison > 0 : comparison >= 0) return true;
  }

  return false;
}

function declaredPackageSpec(pkg: PackageJson): string | null {
  return pkg.dependencies?.[PACKAGE_NAME] ?? pkg.devDependencies?.[PACKAGE_NAME] ?? null;
}

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
  const report: Report = { ok: [], problems: [] };
  const packageVersion = getPackageVersion();

  console.log(`llm-wiki-manager doctor — v${packageVersion}\n`);

  const config = readConfig(cwd, report);
  const pkgPath = join(cwd, 'package.json');
  let pkg: PackageJson | null = null;
  let packageJsonParseFailed = false;
  if (existsSync(pkgPath)) {
    try {
      pkg = readJsonFile<PackageJson>(pkgPath);
    } catch {
      packageJsonParseFailed = true;
    }
  }

  if (config) {
    const installedVersion = getInstalledPackageVersion(cwd);
    const packageSpec = pkg ? declaredPackageSpec(pkg) : null;
    const packageSpecTooOld = packageSpec
      ? dependencySpecIsDefinitelyTooOld(packageSpec, config.version)
      : false;
    if (packageSpecTooOld) {
      report.problems.push(
        `package.json declares ${PACKAGE_NAME} ${packageSpec}, which cannot install scaffold v${config.version} — run npx llm-wiki-manager upgrade to sync package.json`,
      );
    }

    if (installedVersion && installedVersion !== config.version) {
      if (compareVersions(installedVersion, config.version) > 0) {
        report.problems.push(
          `scaffold is v${config.version} but node_modules has v${installedVersion} — run npx llm-wiki-manager upgrade`,
        );
      } else if (packageSpecTooOld) {
        report.problems.push(
          `scaffold is v${config.version} but node_modules has v${installedVersion} — sync package.json before reinstalling ${PACKAGE_NAME}`,
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

    const wikiDir = resolve(cwd, config.wikiDir);
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
        if (await isIndexStale(wikiDir, cwd)) {
          report.problems.push('index.md is stale — run npm run wiki:build');
        } else {
          report.ok.push('index.md is up to date');
        }
      }
    }

    const agentsPath = join(cwd, 'AGENTS.md');
    if (!existsSync(agentsPath)) {
      report.problems.push('root AGENTS.md missing — run init');
    } else if (!readFileSync(agentsPath, 'utf8').includes(MANAGED_SECTION_DELIMITER)) {
      report.problems.push(
        'root AGENTS.md has no llm-wiki-manager managed section — run upgrade to add it',
      );
    } else {
      report.ok.push('root AGENTS.md has the managed section');
    }

    if (existsSync(pkgPath)) {
      if (pkg) {
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

        if (hasWikiScripts(scripts) && !isPackageBinInstalled(cwd)) {
          report.problems.push(
            'llm-wiki-manager is not installed locally — run npm install, then npm run wiki:* (not npx run wiki:*); or use npx llm-wiki-manager <command> before installing',
          );
        }
      } else if (packageJsonParseFailed) {
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
