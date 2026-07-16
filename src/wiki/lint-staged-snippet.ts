export function wikiLintStagedGlob(wikiDir: string): string {
  return `${wikiDir}/**/*.md`;
}

function wikiIndexPath(wikiDir: string): string {
  return `${wikiDir}/index.md`;
}

function quoteShellArg(value: string): string {
  return JSON.stringify(value);
}

function wikiLintStagedTasks(wikiDir: string): string[] {
  return [
    'npm run wiki:build',
    `git add -- ${quoteShellArg(wikiIndexPath(wikiDir))}`,
    'npm run wiki:lint',
    'prettier --write',
  ];
}

/** Valid JSON fragment to merge into package.json root. */
export function formatLintStagedPackageJsonSnippet(wikiDir: string): string {
  const config = {
    [wikiLintStagedGlob(wikiDir)]: wikiLintStagedTasks(wikiDir),
  };
  return `"lint-staged": ${JSON.stringify(config, null, 2)}`;
}

export function printLintStagedSetupGuide(wikiDir: string): void {
  console.log('\nRecommended pre-commit (Husky + lint-staged):\n');
  console.log('  Create .husky/pre-commit containing:');
  console.log('    npx lint-staged\n');
  console.log('  Add to package.json (merge into the root { ... } object):');
  for (const line of formatLintStagedPackageJsonSnippet(wikiDir).split('\n')) {
    console.log(`    ${line}`);
  }
  console.log('');
  console.log('  If you already have "lint-staged", add the wiki glob entry inside it.');
  console.log('  The snippet explicitly stages regenerated index.md after wiki:build.');
  console.log('  See README § Optional git hooks for the full pattern.');
}
