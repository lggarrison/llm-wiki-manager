import { intro, outro, text, isCancel, cancel, log } from '@clack/prompts';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import { templatePath, copyTemplate, amendFile, interpolate } from '../utils/fs.js';

export async function init(): Promise<void> {
  intro(pc.cyan('llm-wiki-manager — wiki scaffold'));

  const projectName = await text({
    message: 'Project name (used in AGENTS.md and schema.md)',
    placeholder: 'my-project',
    validate: (v) => v.trim().length === 0 ? 'Required' : undefined,
  });
  if (isCancel(projectName)) { cancel('Cancelled'); process.exit(0); }

  const wikiDir = await text({
    message: 'Wiki directory name',
    initialValue: 'wiki',
    validate: (v) => v.trim().length === 0 ? 'Required' : undefined,
  });
  if (isCancel(wikiDir)) { cancel('Cancelled'); process.exit(0); }

  const scriptsDir = await text({
    message: 'Scripts directory',
    initialValue: 'scripts/wiki',
    validate: (v) => v.trim().length === 0 ? 'Required' : undefined,
  });
  if (isCancel(scriptsDir)) { cancel('Cancelled'); process.exit(0); }

  const focusDirs = await text({
    message: 'Directories this wiki should document (comma-separated, e.g. src, api)',
    placeholder: 'src',
  });
  if (isCancel(focusDirs)) { cancel('Cancelled'); process.exit(0); }

  const focusDirList = (focusDirs ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  const vars: Record<string, string> = {
    PROJECT_NAME: (projectName as string).trim(),
    WIKI_DIR: (wikiDir as string).trim(),
    SCRIPTS_DIR: (scriptsDir as string).trim(),
    INIT_DATE: new Date().toISOString().slice(0, 10),
    FOCUS_DIRS: focusDirList.length > 0
      ? focusDirList.map((d: string) => `\`${d}/\``).join(', ')
      : 'the entire project',
    FOCUS_DIRS_LIST: focusDirList.length > 0
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
  for (const sub of ['concepts', 'sources', 'raw']) {
    mkdirSync(join(wikiDest, sub), { recursive: true });
    // place a .gitkeep so the directory is tracked by git
    const keep = join(wikiDest, sub, '.gitkeep');
    if (!existsSync(keep)) writeFileSync(keep, '');
  }

  // 2. Scaffold management scripts
  log.step('Installing management scripts…');
  copyTemplate(templatePath('scripts'), scriptsDest, vars);

  // 3. Create or amend AGENTS.md
  log.step('Writing AGENTS.md…');
  const agentsTemplate = readFileSync(templatePath('AGENTS.md'), 'utf8');
  const agentsContent = interpolate(agentsTemplate, vars);

  const amended = amendFile(agentsDest, agentsContent);
  if (!amended) {
    log.warn('AGENTS.md already contains an llm-wiki-manager section — skipped.');
  }

  outro(pc.green('Done!') + ' Next steps:\n' +
    `  • Review ${pc.bold(join((wikiDir as string).trim(), 'schema.md'))} to understand wiki conventions\n` +
    `  • Run ${pc.bold(`node ${(scriptsDir as string).trim()}/lint.mjs`)} to validate your wiki\n` +
    `  • Run ${pc.bold(`node ${(scriptsDir as string).trim()}/build-index.mjs`)} to regenerate index.md\n` +
    `  • See AGENTS.md for instructions to give your LLM agent`
  );
}
