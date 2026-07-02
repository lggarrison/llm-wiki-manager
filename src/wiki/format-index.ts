import { createRequire } from 'module';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

type PrettierModule = {
  format: (source: string, options?: { filepath?: string; parser?: string }) => Promise<string>;
};

const require = createRequire(import.meta.url);

function findPackageRoot(startFile: string): string {
  let dir = dirname(startFile);
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('llm-wiki-manager: could not locate package root');
}

const BUNDLED_PACKAGE_ROOT = findPackageRoot(fileURLToPath(import.meta.url));

function loadPrettier(repoRoot: string): PrettierModule | null {
  for (const root of [repoRoot, BUNDLED_PACKAGE_ROOT]) {
    try {
      const resolved = require.resolve('prettier', { paths: [root] });
      return require(resolved) as PrettierModule;
    } catch {
      // try next root
    }
  }
  return null;
}

export async function formatIndexMarkdown(
  content: string,
  indexPath: string,
  repoRoot: string,
): Promise<string> {
  const prettier = loadPrettier(repoRoot);
  if (!prettier) return content;
  try {
    return await prettier.format(content, { filepath: indexPath, parser: 'markdown' });
  } catch {
    return content;
  }
}
