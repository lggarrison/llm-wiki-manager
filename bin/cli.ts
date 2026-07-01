#!/usr/bin/env node
import pc from 'picocolors';
import { init } from '../src/commands/init.js';
import { upgrade } from '../src/commands/upgrade.js';

type Command = () => Promise<void>;

const [, , command = 'init'] = process.argv;

const commands: Record<string, Command> = { init, upgrade };

if (!commands[command]) {
  console.error(pc.red(`Unknown command: ${command}`));
  console.error(
    `Usage: llm-wiki-manager <command>\n\nCommands:\n  init      Scaffold a new LLM wiki\n  upgrade   Refresh template files and migrate pages`,
  );
  process.exit(1);
}

commands[command]().catch((err: Error) => {
  console.error(pc.red(err.message));
  process.exit(1);
});
