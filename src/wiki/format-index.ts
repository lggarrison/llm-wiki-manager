import { createRequire } from 'module';
import { getPackageRoot } from '../utils/fs.js';
import type { Options } from 'prettier';

type PrettierModule = {
  format: (source: string, options?: Options) => Promise<string>;
  resolveConfig?: (filePath: string) => Promise<Options | null>;
};

const require = createRequire(import.meta.url);

function loadPrettier(repoRoot: string): PrettierModule | null {
  for (const root of [repoRoot, getPackageRoot()]) {
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
    const config = prettier.resolveConfig ? await prettier.resolveConfig(indexPath) : null;
    return await prettier.format(content, {
      ...(config ?? {}),
      filepath: indexPath,
      parser: 'markdown',
    });
  } catch {
    return content;
  }
}
