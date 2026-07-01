#!/usr/bin/env node
import pc from 'picocolors';
import { init } from '../src/commands/init.js';
import { upgrade } from '../src/commands/upgrade.js';
import { getPackageVersion } from '../src/utils/fs.js';
import { resolveWikiContext, flagValue, hasFlag } from '../src/wiki/context.js';
import { runLint } from '../src/wiki/lint.js';
import { runBuild, runCheck } from '../src/wiki/build-index.js';
import { runSync } from '../src/wiki/sync-see-also.js';
import { runLog } from '../src/wiki/log.js';
import { runHelp } from '../src/wiki/help.js';
import { runSetupHusky } from '../src/wiki/setup-husky.js';
import { runDoctor } from '../src/wiki/doctor.js';

const USAGE = `Usage: llm-wiki-manager <command> [options]

Commands:
  init          Scaffold a new LLM wiki
  upgrade       Refresh template files and migrate pages
  help          List wiki npm scripts and when to run them
  lint          Validate frontmatter, links, and structure
  build         Regenerate index.md from page frontmatter
  check         Verify index.md is up to date (read-only)
  sync          Sync related: frontmatter to body links
  log           Append operation entries to log.md
  doctor        Check scaffold health and suggest fixes
  setup-husky   Wire wiki:check into Husky pre-push

Options:
  -h, --help      Show this help
  -v, --version   Show the installed version

Docs: https://github.com/lggarrison/llm-wiki-manager#readme`;

const [, , rawCommand = 'init', ...rest] = process.argv;
const command = rawCommand;

if (command === '--help' || command === '-h') {
  console.log(USAGE);
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  console.log(getPackageVersion());
  process.exit(0);
}

function wikiContextFromArgs(args: string[]) {
  return resolveWikiContext({
    wikiDir: flagValue(args, '--wiki-dir'),
    repoRoot: flagValue(args, '--repo-root'),
  });
}

async function dispatch(): Promise<number> {
  switch (command) {
    case 'init':
      await init();
      return 0;
    case 'upgrade':
      await upgrade();
      return 0;
    case 'help':
      return runHelp();
    case 'lint':
      return runLint(wikiContextFromArgs(rest), { warnOnly: hasFlag(rest, '--warn-only') });
    case 'build':
      return runBuild(wikiContextFromArgs(rest));
    case 'check':
      return runCheck(wikiContextFromArgs(rest));
    case 'sync':
      return runSync(wikiContextFromArgs(rest), { dry: hasFlag(rest, '--dry') });
    case 'log':
      return runLog(wikiContextFromArgs(rest), rest);
    case 'doctor':
      return runDoctor();
    case 'setup-husky':
      return runSetupHusky();
    default:
      console.error(pc.red(`Unknown command: ${command}`));
      console.error(USAGE);
      return 1;
  }
}

dispatch()
  .then((code) => process.exit(code))
  .catch((err: Error) => {
    console.error(pc.red(err.message));
    if (process.env.DEBUG) {
      console.error(err.stack ?? '(no stack trace available)');
    } else {
      console.error(pc.dim('Re-run with DEBUG=1 for a full stack trace.'));
    }
    process.exit(1);
  });
