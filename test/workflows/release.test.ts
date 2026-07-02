import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(import.meta.dirname, '..', '..');
const releaseWorkflow = readFileSync(join(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8');
const releasingDoc = readFileSync(join(repoRoot, 'RELEASING.md'), 'utf8');

describe('release workflow', () => {
  it('includes a sync-develop job that runs after release', () => {
    expect(releaseWorkflow).toMatch(/sync-develop:/);
    expect(releaseWorkflow).toMatch(/needs:\s*release/);
  });

  it('merges origin/main into develop after publish', () => {
    expect(releaseWorkflow).toMatch(/git merge origin\/main/);
    expect(releaseWorkflow).toMatch(/git checkout develop/);
    expect(releaseWorkflow).toMatch(/git push origin develop/);
  });

  it('opens a PR when the merge conflicts', () => {
    expect(releaseWorkflow).toMatch(/git merge --abort/);
    expect(releaseWorkflow).toMatch(/gh pr create/);
    expect(releaseWorkflow).toMatch(/--base develop/);
  });
});

describe('RELEASING.md', () => {
  it('documents post-release main into develop sync', () => {
    expect(releasingDoc).toMatch(/sync main into develop/i);
    expect(releasingDoc).toMatch(/sync-develop/);
  });
});
