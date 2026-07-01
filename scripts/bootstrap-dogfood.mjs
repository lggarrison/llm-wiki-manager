import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(PACKAGE_ROOT);

const { mergePackageJsonScripts, buildTemplateVars, upgradeScripts } = await import(
  pathToFileURL(join(PACKAGE_ROOT, 'dist/src/utils/fs.js')).href
);

const vars = buildTemplateVars({
  projectName: 'llm-wiki-manager',
  wikiDir: 'wiki',
  scriptsDir: 'scripts/wiki',
  focusDirs: ['src', 'templates'],
});

const scriptsDest = resolve(PACKAGE_ROOT, 'scripts/wiki');
const result = upgradeScripts(scriptsDest, vars);
console.log('Refreshed scripts/wiki from templates/scripts');
console.log(
  `  created: ${result.created.length}, updated: ${result.updated.length}, skipped: ${result.skipped.length}`,
);
console.log('package.json:', mergePackageJsonScripts(PACKAGE_ROOT, vars.SCRIPTS_DIR));
