import { intro, outro, text, isCancel, cancel, log } from '@clack/prompts';
import { readFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import pc from 'picocolors';
import {
  templatePath,
  copyTemplate,
  amendFile,
  interpolate,
  mergePackageJsonScripts,
  scopeSlugFromFocusDir,
  scaffoldWikiEmptyDirs,
  scaffoldEntityOverviews,
} from '../utils/fs.js';

export async function init(): Promise<void> {
  intro(pc.cyan('llm-wiki-manager — wiki scaffold'));

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

  const focusDirList = (focusDirs ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  const initDate = new Date().toISOString().slice(0, 10);
  const entitySlugs = focusDirList.map((d: string) => scopeSlugFromFocusDir(d));
  const entityScopeLines =
    entitySlugs.length > 0
      ? entitySlugs.join('\n')
      : '# Add scope slugs below as you define documented source areas';

  const vars: Record<string, string> = {
    PROJECT_NAME: (projectName as string).trim(),
    WIKI_DIR: (wikiDir as string).trim(),
    SCRIPTS_DIR: (scriptsDir as string).trim(),
    INIT_DATE: initDate,
    ENTITY_SCOPE_LINES: entityScopeLines,
    FOCUS_DIRS:
      focusDirList.length > 0
        ? focusDirList.map((d: string) => `\`${d}/\``).join(', ')
        : 'the entire project',
    FOCUS_DIRS_LIST:
      focusDirList.length > 0
        ? focusDirList.map((d: string) => `- \`${d}/\``).join('\n')
        : '- _(whole project — no specific directory scope)_',
  };

  const cwd = process.cwd();
  const wikiDest = resolve(cwd, (wikiDir as string).trim());
  const scriptsDest = resolve(cwd, (scriptsDir as string).trim());
  const agentsDest = resolve(cwd, 'AGENTS.md');

  // 1. Scaffold wiki directory
  log.step('Scaffolding wiki directory…');
  copyTemplate(templatePath('wiki'), wikiDest, vars);
  scaffoldWikiEmptyDirs(wikiDest);
  if (focusDirList.length > 0) {
    scaffoldEntityOverviews(wikiDest, focusDirList, initDate);
  }

  // 2. Scaffold management scripts
  log.step('Installing management scripts…');
  copyTemplate(templatePath('scripts'), scriptsDest, vars);

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
    log.warn('AGENTS.md already contains an llm-wiki-manager section — skipped.');
  }

  outro(
    pc.green('Done!') +
      ' Next steps:\n' +
      `  • Review ${pc.bold(join((wikiDir as string).trim(), 'schema.md'))} to understand wiki conventions\n` +
      `  • Run ${pc.bold('npm run wiki:help')} for a list of wiki commands\n` +
      `  • Run ${pc.bold('npm run wiki:lint')} to validate your wiki\n` +
      `  • Run ${pc.bold('npm run wiki:build')} to regenerate index.md\n` +
      `  • Open ${pc.bold(join((wikiDir as string).trim(), 'README.md'))} (human entry) and ${pc.bold(join((wikiDir as string).trim(), 'AGENTS.md'))} (agent entry)\n` +
      `  • Optional git hooks (Husky + lint-staged) — see README "Optional git hooks"\n` +
      `            • ${pc.bold('npm run wiki:setup:husky')} wires pre-push wiki:check\n`,
  );
}
