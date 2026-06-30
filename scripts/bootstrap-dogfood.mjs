import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(PACKAGE_ROOT);

const { templatePath, copyTemplate, mergePackageJsonScripts } = await import(
  pathToFileURL(join(PACKAGE_ROOT, 'dist/src/utils/fs.js')).href
);

const vars = {
  PROJECT_NAME: 'llm-wiki-manager',
  WIKI_DIR: 'wiki',
  SCRIPTS_DIR: 'scripts/wiki',
  INIT_DATE: new Date().toISOString().slice(0, 10),
  FOCUS_DIRS: '`src/`, `templates/`',
  FOCUS_DIRS_LIST: '- `src/\n- `templates/`',
};

const scriptsDest = resolve(PACKAGE_ROOT, 'scripts/wiki');

copyTemplate(templatePath('scripts'), scriptsDest, vars);
console.log('Refreshed scripts/wiki from templates/scripts');
console.log('package.json:', mergePackageJsonScripts(PACKAGE_ROOT, vars.SCRIPTS_DIR));
