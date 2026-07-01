import { spawnSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default function globalSetup(): void {
  const result = spawnSync('npm run build', {
    cwd: PACKAGE_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error('globalSetup: npm run build failed');
  }
}
