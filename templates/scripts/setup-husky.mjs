#!/usr/bin/env node
/**
 * setup-husky.mjs — append wiki lint/check commands to Husky git hooks
 * Usage: node {{SCRIPTS_DIR}}/setup-husky.mjs
 *
 * Requires Husky to be installed: npm install -D husky
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MARKER = '# llm-wiki-manager';
const HUSKY_DIR = '.husky';

const HOOKS = {
  'pre-commit': 'npm run wiki:lint',
  'pre-push': 'npm run wiki:check',
};

function amendHook(hookName, command) {
  const hookPath = join(HUSKY_DIR, hookName);

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

if (!existsSync('.git')) {
  console.error('setup-husky: not a git repository (.git missing)');
  process.exit(1);
}

let husky;
try {
  husky = (await import('husky')).default;
} catch {
  console.error(
    'setup-husky: husky is not installed.\n' +
      '  npm install -D husky\n' +
      '  npm run wiki:setup:husky',
  );
  process.exit(1);
}

husky();
mkdirSync(HUSKY_DIR, { recursive: true });

const results = {};
for (const [hook, command] of Object.entries(HOOKS)) {
  results[hook] = amendHook(hook, command);
}

for (const [hook, status] of Object.entries(results)) {
  const label = status === 'created' ? 'created' : status === 'appended' ? 'appended to' : 'already configured';
  console.log(`  ${hook}: ${label}`);
}

console.log('\nWiki hooks ready.');
