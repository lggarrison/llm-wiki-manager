import { readInstallConfig } from '../utils/fs.js';

export function runHelp(cwd: string = process.cwd()): number {
  const config = readInstallConfig(cwd);
  const wikiDir = config?.wikiDir ?? 'wiki';

  const commands = [
    {
      name: 'wiki:help',
      summary: 'Show this help message',
      when: 'Any time you need a reminder of available wiki commands',
      example: 'npm run wiki:help',
    },
    {
      name: 'wiki:lint',
      summary: 'Validate frontmatter, links, and wiki structure',
      when: 'Before committing wiki changes; after editing pages; periodic health checks',
      example: 'npm run wiki:lint',
    },
    {
      name: 'wiki:build',
      summary: `Regenerate ${wikiDir}/index.md from page frontmatter`,
      when: 'After adding, removing, or renaming wiki pages; after ingest workflows',
      example: 'npm run wiki:build',
    },
    {
      name: 'wiki:check',
      summary: 'Verify index.md is up to date (read-only, exits 1 if stale)',
      when: 'Pre-push hooks or CI — confirms index.md matches current pages without writing files',
      example: 'npm run wiki:check',
    },
    {
      name: 'wiki:sync',
      summary: 'Sync related: frontmatter entries to body links under "## See also"',
      when: 'After updating related: in frontmatter; before lint if sync warnings appear',
      example: 'npm run wiki:sync',
    },
    {
      name: 'wiki:log',
      summary: `Append an operation entry to ${wikiDir}/log.md`,
      when: 'After ingest, query, lint, or maintenance work — keeps an audit trail',
      example: 'npm run wiki:log -- add ingest "Title of source"',
    },
    {
      name: 'wiki:setup:husky',
      summary: 'Wire wiki:check into Husky pre-push and print lint-staged pre-commit guide',
      when: 'Once, after installing Husky — appends to existing pre-push or creates it',
      example: 'npm run wiki:setup:husky',
    },
  ];

  console.log(`Wiki commands — ${wikiDir}/\n`);

  for (const cmd of commands) {
    console.log(`  ${cmd.name}`);
    console.log(`    ${cmd.summary}`);
    console.log(`    When: ${cmd.when}`);
    console.log(`    Run:  ${cmd.example}`);
    console.log('');
  }

  console.log('Typical workflows\n');

  console.log('  After ingesting a source:');
  console.log('    npm run wiki:sync');
  console.log('    npm run wiki:build');
  console.log('    npm run wiki:log -- add ingest "<source title>"');
  console.log('');

  console.log('  After editing wiki pages:');
  console.log('    npm run wiki:build');
  console.log('    npm run wiki:lint');
  console.log('');

  console.log('  Optional git hooks (requires Husky — see README):');
  console.log('    npm install -D husky lint-staged');
  console.log('    # add wiki/**/*.md to lint-staged in package.json (see README)');
  console.log('    # .husky/pre-commit → npx lint-staged');
  console.log('    npm run wiki:setup:husky   # wires pre-push wiki:check');
  console.log('');

  console.log('  Refreshing scaffold after a package update:');
  console.log('    npx llm-wiki-manager doctor    # check scaffold health first');
  console.log('    npx llm-wiki-manager upgrade');
  console.log('    npx llm-wiki-manager upgrade --dry-run');
  console.log('');

  console.log('Without npm scripts, run llm-wiki-manager <command> (e.g. llm-wiki-manager lint)');

  return 0;
}

export function getWikiDirLabel(cwd: string): string {
  const config = readInstallConfig(cwd);
  return config?.wikiDir ?? 'wiki';
}
