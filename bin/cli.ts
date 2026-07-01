#!/usr/bin/env node
import pc from 'picocolors';
import { init } from '../src/commands/init.js';
import { upgrade } from '../src/commands/upgrade.js';
import { getPackageVersion } from '../src/utils/fs.js';

type Command = () => Promise<void>;

const USAGE = `Usage: llm-wiki-manager <command> [options]

Commands:
  init      Scaffold a new LLM wiki (default)
  upgrade   Refresh template files and migrate pages

Options:
  -h, --help      Show this help
  -v, --version   Show the installed version

Docs: https://github.com/lggarrison/llm-wiki-manager#readme`;

const [, , command = 'init'] = process.argv;

if (command === '--help' || command === '-h') {
  console.log(USAGE);
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  console.log(getPackageVersion());
  process.exit(0);
}

const commands: Record<string, Command> = { init, upgrade };

if (!commands[command]) {
  console.error(pc.red(`Unknown command: ${command}`));
  console.error(USAGE);
  process.exit(1);
}

commands[command]().catch((err: Error) => {
  console.error(pc.red(err.message));
  process.exit(1);
});
