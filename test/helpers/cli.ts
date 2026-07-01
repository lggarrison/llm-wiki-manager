import { spawnSync } from 'child_process';
import { join } from 'path';
import { PACKAGE_ROOT } from './paths.js';

const CLI_PATH = join(PACKAGE_ROOT, 'dist', 'bin', 'cli.js');

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export function runBuiltCli(
  cwd: string,
  args: string[],
  options: { input?: string } = {},
): CliResult {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    input: options.input,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function runNodeScript(cwd: string, scriptPath: string, args: string[] = []): CliResult {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
