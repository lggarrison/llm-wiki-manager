const WIKI_LINT_STAGED_TASKS = [
  'npm run wiki:build',
  'npm run wiki:lint',
  'prettier --write',
] as const;

export function wikiLintStagedGlob(wikiDir: string): string {
  return `${wikiDir}/**/*.md`;
}

/** Valid JSON fragment to merge into package.json root. */
export function formatLintStagedPackageJsonSnippet(wikiDir: string): string {
  const config = {
    [wikiLintStagedGlob(wikiDir)]: [...WIKI_LINT_STAGED_TASKS],
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
  console.log('  lint-staged re-stages regenerated index.md after wiki:build.');
  console.log('  See README § Optional git hooks for the full pattern.');
}
