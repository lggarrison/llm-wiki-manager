import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { WIKI_SCRIPT_KEYS } from '../../src/utils/fs.js';
import { scriptPath } from '../helpers/wiki.js';

function runHelp() {
  return spawnSync('node', [scriptPath('help.mjs')], { encoding: 'utf8' });
}

describe('help.mjs', () => {
  it('prints all wiki commands and workflow hints', () => {
    const result = runHelp();
    expect(result.status).toBe(0);

    const out = result.stdout;
    for (const cmd of WIKI_SCRIPT_KEYS) {
      expect(out).toContain(cmd);
    }
    expect(out).toContain('Typical workflows');
    expect(out).toContain('wiki:setup:husky');
    expect(out).toContain('npm install -D husky');
  });
});
