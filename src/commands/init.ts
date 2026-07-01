import { intro, outro, text, isCancel, cancel, log } from '@clack/prompts';
import { readFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import pc from 'picocolors';
import {
  templatePath,
  amendFile,
  interpolate,
  mergePackageJsonScripts,
  scaffoldWikiEmptyDirs,
  scaffoldEntityOverviews,
  scaffoldWikiTemplates,
  scaffoldScripts,
  buildTemplateVars,
  writeInstallConfig,
  getPackageVersion,
  isExistingInstall,
  readInstallConfig,
} from '../utils/fs.js';

type InitFlagValues = {
  projectName: string;
  wikiDir: string;
  scriptsDir: string;
  focusDirs: string;
};

function parseInitArgs(argv: string[]): InitFlagValues | null {
  const flagIndex = argv.indexOf('--project-name');
  if (flagIndex === -1) return null;

  const projectName = argv[flagIndex + 1]?.trim();
  if (!projectName) {
    throw new Error('--project-name requires a value');
  }

  const readFlag = (name: string, fallback: string): string => {
    const idx = argv.indexOf(name);
    if (idx === -1) return fallback;
    const value = argv[idx + 1]?.trim();
    if (!value) throw new Error(`${name} requires a value`);
    return value;
  };

  return {
    projectName,
    wikiDir: readFlag('--wiki-dir', 'wiki'),
    scriptsDir: readFlag('--scripts-dir', 'scripts/wiki'),
    focusDirs: readFlag('--focus-dirs', ''),
  };
}

async function promptInitValues(): Promise<InitFlagValues> {
  const projectName = await text({
    message: 'Project name (used in AGENTS.md and schema.md)',
    initialValue: basename(process.cwd()),
    validate: (v) => (v.trim().length === 0 ? 'Required' : undefined),
  });
  if (isCancel(projectName)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const wikiDir = await text({
    message: 'Wiki directory name',
    initialValue: 'wiki',
    validate: (v) => (v.trim().length === 0 ? 'Required' : undefined),
  });
  if (isCancel(wikiDir)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const scriptsDir = await text({
    message: 'Scripts directory',
    initialValue: 'scripts/wiki',
    validate: (v) => (v.trim().length === 0 ? 'Required' : undefined),
  });
  if (isCancel(scriptsDir)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const focusDirs = await text({
    message: 'Directories this wiki should document (comma-separated, e.g. src, api)',
    placeholder: 'src',
  });
  if (isCancel(focusDirs)) {
    cancel('Cancelled');
    process.exit(0);
  }

  return {
    projectName: (projectName as string).trim(),
    wikiDir: (wikiDir as string).trim(),
    scriptsDir: (scriptsDir as string).trim(),
    focusDirs: focusDirs ?? '',
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
  const scriptsDirStr = values.scriptsDir;
  const projectNameStr = values.projectName;
  const initTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const vars = buildTemplateVars({
    projectName: projectNameStr,
    wikiDir: wikiDirStr,
    scriptsDir: scriptsDirStr,
    focusDirs: focusDirList,
    initTimestamp,
  });

  const cwd = process.cwd();
  const wikiDest = resolve(cwd, wikiDirStr);
  const scriptsDest = resolve(cwd, scriptsDirStr);
  const agentsDest = resolve(cwd, 'AGENTS.md');
  const reInit = isExistingInstall(cwd, wikiDirStr);

  if (reInit) {
    log.warn('Existing wiki detected — only missing scaffold files will be created.');
    log.info(`To refresh templates, run ${pc.bold('npx llm-wiki-manager upgrade')}.`);
  }

  // 1. Scaffold wiki directory (create-if-missing)
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

  // 2. Scaffold management scripts (create-if-missing)
  log.step('Installing management scripts…');
  const scriptsResult = scaffoldScripts(scriptsDest, vars, { overwrite: false });
  if (scriptsResult.created.length > 0) {
    log.info(`Created: ${scriptsResult.created.join(', ')}`);
  }

  // 3. Add npm scripts to package.json (when present)
  const pkgResult = mergePackageJsonScripts(cwd, vars.SCRIPTS_DIR);
  if (pkgResult.status === 'merged') {
    log.step(`Adding npm scripts to package.json (${pkgResult.added.join(', ')})…`);
  } else if (pkgResult.status === 'no-package-json') {
    log.warn('No package.json found — skipped npm scripts (see README for manual setup).');
  } else {
    log.warn('package.json already has wiki scripts — skipped.');
  }

  // 4. Create or amend AGENTS.md
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
    scriptsDir: scriptsDirStr,
    focusDirs: focusDirList.length > 0 ? focusDirList : (existingConfig?.focusDirs ?? []),
  });

  outro(
    pc.green('Done!') +
      ' Next steps:\n' +
      `  • Review ${pc.bold(join(wikiDirStr, 'schema.md'))} to understand wiki conventions\n` +
      `  • Run ${pc.bold('npm run wiki:help')} for a list of wiki commands\n` +
      `  • Run ${pc.bold('npm run wiki:lint')} to validate your wiki\n` +
      `  • Run ${pc.bold('npm run wiki:build')} to regenerate index.md\n` +
      `  • Open ${pc.bold(join(wikiDirStr, 'README.md'))} (human entry) and ${pc.bold(join(wikiDirStr, 'AGENTS.md'))} (agent entry)\n` +
      (reInit
        ? `  • Run ${pc.bold('npx llm-wiki-manager upgrade')} to refresh template files\n`
        : '') +
      `  • Optional git hooks (Husky + lint-staged) — see README "Optional git hooks"\n` +
      `            • ${pc.bold('npm run wiki:setup:husky')} wires pre-push wiki:check\n`,
  );
}
