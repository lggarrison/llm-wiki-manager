// Sets up Husky git hooks for local development only.
// Skipped in CI, production installs, and when this package is consumed as a
// dependency (no .git present) so it never breaks `npx github:...` installs.
import { existsSync } from 'node:fs';

if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  process.exit(0);
}

if (!existsSync('.git')) {
  process.exit(0);
}

const husky = (await import('husky')).default;
husky();
