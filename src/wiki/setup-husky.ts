import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { readInstallConfig } from '../utils/fs.js';
import { printLintStagedSetupGuide } from './lint-staged-snippet.js';

const MARKER = '# llm-wiki-manager';
const HUSKY_DIR = '.husky';

const HOOKS: Record<string, string> = {
  'pre-push': 'npm run wiki:check',
};

function amendHook(
  cwd: string,
  hookName: string,
  command: string,
): 'unchanged' | 'appended' | 'created' {
  const hookPath = join(cwd, HUSKY_DIR, hookName);

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(MARKER) || existing.includes(command)) {
      return 'unchanged';
    }
    writeFileSync(hookPath, `${existing.trimEnd()}\n\n${MARKER}\n${command}\n`, 'utf8');
    return 'appended';
  }

  writeFileSync(hookPath, `${command}\n`, 'utf8');
  return 'created';
}

function printLintStagedRecommendation(wikiDir: string): void {
  printLintStagedSetupGuide(wikiDir);
}

export async function runSetupHusky(cwd: string = process.cwd()): Promise<number> {
  const config = readInstallConfig(cwd);
  const wikiDir = config?.wikiDir ?? 'wiki';

  if (!existsSync(join(cwd, '.git'))) {
    console.error('setup-husky: not a git repository (.git missing)');
    return 1;
  }

  let husky: () => void;
  try {
    const huskyEntry = join(cwd, 'node_modules', 'husky', 'index.js');
    if (!existsSync(huskyEntry)) {
      throw new Error('husky not installed in project');
    }
    const mod = await import(pathToFileURL(huskyEntry).href);
    husky = mod.default;
  } catch {
    console.error(
      'setup-husky: husky is not installed.\n' +
        '  npm install -D husky\n' +
        '  npm run wiki:setup:husky',
    );
    return 1;
  }

  husky();
  mkdirSync(join(cwd, HUSKY_DIR), { recursive: true });

  const results: Record<string, 'unchanged' | 'appended' | 'created'> = {};
  for (const [hook, command] of Object.entries(HOOKS)) {
    results[hook] = amendHook(cwd, hook, command);
  }

  for (const [hook, status] of Object.entries(results)) {
    const label =
      status === 'created'
        ? 'created'
        : status === 'appended'
          ? 'appended to'
          : 'already configured';
    console.log(`  ${hook}: ${label}`);
  }

  console.log('\nWiki pre-push hook ready.');
  printLintStagedRecommendation(wikiDir);
  return 0;
}
