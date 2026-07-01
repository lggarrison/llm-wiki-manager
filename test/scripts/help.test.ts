import { describe, it, expect } from 'vitest';
import { WIKI_SCRIPT_KEYS } from '../../src/utils/fs.js';
import { runBuiltCli } from '../helpers/cli.js';

describe('help command', () => {
  it('prints all wiki commands and workflow hints', () => {
    const result = runBuiltCli(process.cwd(), ['help']);
    expect(result.status).toBe(0);

    const out = result.stdout;
    for (const cmd of WIKI_SCRIPT_KEYS) {
      expect(out).toContain(cmd);
    }
    expect(out).toContain('Typical workflows');
    expect(out).toContain('wiki:setup:husky');
    expect(out).toContain('npm install -D husky');
    expect(out).toContain('llm-wiki-manager');
  });
});
