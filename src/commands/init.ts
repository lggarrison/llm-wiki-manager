import { intro, outro, text, isCancel, cancel, log } from '@clack/prompts';
import { readFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import pc from 'picocolors';
import {
  templatePath,
  amendFile,
  interpolate,
  mergePackageJsonScripts,
  mergePackageJsonDevDependency,
  scaffoldWikiEmptyDirs,
  scaffoldEntityOverviews,
  scaffoldWikiTemplates,
  buildTemplateVars,
  writeInstallConfig,
  getPackageVersion,
  isExistingInstall,
  getPackageInstallStatus,
  readInstallConfig,
} from '../utils/fs.js';
import { resolveWikiContext } from '../wiki/context.js';
import { runBuild } from '../wiki/build-index.js';

type InitFlagValues = {
  projectName: string;
  wikiDir: string;
  focusDirs: string;
};

const INIT_FLAGS = new Set(['--project-name', '--wiki-dir', '--focus-dirs']);

export function parseInitArgs(argv: string[]): InitFlagValues | null {
  const flagIndex = argv.indexOf('--project-name');
  if (flagIndex === -1) return null;

  for (const arg of argv) {
    if (arg.startsWith('-') && !INIT_FLAGS.has(arg)) {
      throw new Error(`Unknown init option: ${arg}`);
    }
  }

  const readFlag = (name: string, fallback?: string): string => {
    const idx = argv.indexOf(name);
    if (idx === -1) {
      if (fallback !== undefined) return fallback;
      throw new Error(`${name} requires a value`);
    }
    const rawValue = argv[idx + 1];
    const value = rawValue?.trim();
    if (!value) throw new Error(`${name} requires a value`);
    if (rawValue.startsWith('-')) throw new Error(`${name} requires a value`);
    return value;
  };

  return {
    projectName: readFlag('--project-name'),
    wikiDir: readFlag('--wiki-dir', 'wiki'),
    focusDirs: readFlag('--focus-dirs', ''),
  };
}

async function promptInitValues(): Promise<InitFlagValues> {
  const projectName = await text({
    message: 'Project name (used in AGENTS.md and schema.md)',
    initialValue: basename(process.cwd()),
    validate: (v) => ((v ?? '').trim().length === 0 ? 'Required' : undefined),
  });
  if (isCancel(projectName)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const wikiDir = await text({
    message: 'Wiki directory name',
    initialValue: 'wiki',
    validate: (v) => ((v ?? '').trim().length === 0 ? 'Required' : undefined),
  });
  if (isCancel(wikiDir)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const focusDirs = await text({
    message: 'Directories this wiki should document (comma-separated, e.g. src, api)',
    initialValue: 'src',
  });
  if (isCancel(focusDirs)) {
    cancel('Cancelled');
    process.exit(0);
  }

  return {
    projectName: (projectName as string).trim(),
    wikiDir: (wikiDir as string).trim(),
    focusDirs: typeof focusDirs === 'string' ? focusDirs.trim() : '',
  };
}

export async function init(): Promise<void> {
  intro(pc.cyan('llm-wiki-manager — wiki scaffold'));

  const fromFlags = parseInitArgs(process.argv.slice(3));
  const values = fromFlags ?? (await promptInitValues());

  const focusDirList = values.focusDirs
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const wikiDirStr = values.wikiDir;
  const projectNameStr = values.projectName;
  const initTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const vars = buildTemplateVars({
    projectName: projectNameStr,
    wikiDir: wikiDirStr,
    focusDirs: focusDirList,
    initTimestamp,
  });

  const cwd = process.cwd();
  const wikiDest = resolve(cwd, wikiDirStr);
  const agentsDest = resolve(cwd, 'AGENTS.md');
  const reInit = isExistingInstall(cwd, wikiDirStr);

  if (reInit) {
    log.warn('Existing wiki detected — only missing scaffold files will be created.');
    log.info(`To refresh templates, run ${pc.bold('npx llm-wiki-manager upgrade')}.`);
  }

  log.step('Scaffolding wiki directory…');
  const wikiResult = scaffoldWikiTemplates(wikiDest, vars, { overwrite: false });
  if (wikiResult.created.length > 0) {
    log.info(`Created: ${wikiResult.created.join(', ')}`);
  }
  if (reInit && wikiResult.skipped.length > 0) {
    log.info(`Skipped existing: ${wikiResult.skipped.length} template file(s)`);
  }
  scaffoldWikiEmptyDirs(wikiDest);
  if (focusDirList.length > 0) {
    scaffoldEntityOverviews(wikiDest, focusDirList, initTimestamp);
  }

  // Generate index.md from the scaffolded pages so wiki:check passes immediately
  log.step('Building index.md…');
  await runBuild(resolveWikiContext({ cwd, wikiDir: wikiDirStr, repoRoot: cwd }));

  const pkgResult = mergePackageJsonScripts(cwd);
  const depResult = mergePackageJsonDevDependency(cwd);
  const runningVersion = getPackageVersion();
  if (pkgResult.status === 'merged') {
    log.step(`Adding npm scripts to package.json (${pkgResult.added.join(', ')})…`);
  } else if (pkgResult.status === 'no-package-json') {
    log.warn('No package.json found — skipped npm scripts (see README for manual setup).');
  } else if (depResult.status === 'merged') {
    log.step(`Adding ${pc.bold('llm-wiki-manager')} to devDependencies…`);
  } else if (depResult.status === 'updated') {
    log.step(
      `Updating ${pc.bold('llm-wiki-manager')} devDependency (${depResult.previous} → ^${depResult.version})…`,
    );
  } else {
    log.warn('package.json already has wiki scripts — skipped.');
  }

  log.step('Writing AGENTS.md…');
  const agentsTemplate = readFileSync(templatePath('AGENTS.md'), 'utf8');
  const agentsContent = interpolate(agentsTemplate, vars);

  const amended = amendFile(agentsDest, agentsContent);
  if (!amended) {
    log.warn(
      'AGENTS.md already contains an llm-wiki-manager section — skipped. Run upgrade to refresh.',
    );
  }

  const existingConfig = readInstallConfig(cwd);
  writeInstallConfig(cwd, {
    version: getPackageVersion(),
    projectName: projectNameStr,
    wikiDir: wikiDirStr,
    focusDirs: focusDirList.length > 0 ? focusDirList : (existingConfig?.focusDirs ?? []),
  });

  const hasPackageJson = pkgResult.status !== 'no-package-json';
  const installStatus = hasPackageJson ? getPackageInstallStatus(cwd, runningVersion) : null;
  const wikiHelpCmd = hasPackageJson ? 'npm run wiki:help' : 'npx llm-wiki-manager help';
  const wikiLintCmd = hasPackageJson ? 'npm run wiki:lint' : 'npx llm-wiki-manager lint';
  const wikiBuildCmd = hasPackageJson ? 'npm run wiki:build' : 'npx llm-wiki-manager build';
  const wikiDoctorCmd = hasPackageJson ? 'npm run wiki:doctor' : 'npx llm-wiki-manager doctor';

  outro(
    pc.green('Done!') +
      ` Scaffolded with llm-wiki-manager v${runningVersion}.\n` +
      ' Next steps:\n' +
      `  • Review ${pc.bold(join(wikiDirStr, 'schema.md'))} to understand wiki conventions\n` +
      `  • Run ${pc.bold(wikiHelpCmd)} for a list of wiki commands\n` +
      `  • Run ${pc.bold(wikiLintCmd)} to validate your wiki\n` +
      `  • Run ${pc.bold(wikiBuildCmd)} to regenerate index.md\n` +
      `  • Run ${pc.bold(wikiDoctorCmd)} to check scaffold health\n` +
      `  • Open ${pc.bold(join(wikiDirStr, 'README.md'))} (human entry) and ${pc.bold(join(wikiDirStr, 'AGENTS.md'))} (agent entry)\n` +
      (reInit
        ? `  • Run ${pc.bold('npx llm-wiki-manager upgrade')} to refresh template files\n`
        : '') +
      (hasPackageJson
        ? `  • Optional git hooks (Husky + lint-staged) — see README "Optional git hooks"\n` +
          `            • ${pc.bold('npm run wiki:setup:husky')} wires pre-push wiki:check\n` +
          `  • Use ${pc.bold('npm run wiki:*')} for wiki scripts (not ${pc.bold('npx run')} — that is a different package)\n`
        : `  • Use ${pc.bold('npx llm-wiki-manager <command>')} for wiki tasks (no package.json — see README)\n`) +
      (installStatus?.needsInstall
        ? installStatus.reason === 'stale'
          ? `\n  ${pc.yellow('Final Step:')} ${pc.bold('npm install')} — local install is v${installStatus.installedVersion} but scaffold used v${installStatus.targetVersion}\n`
          : `\n  ${pc.yellow('Final Step:')} ${pc.bold('npm install')} — required before ${pc.bold('npm run wiki:*')} works\n`
        : ''),
  );
}
