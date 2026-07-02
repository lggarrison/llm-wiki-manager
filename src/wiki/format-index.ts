import { createRequire } from 'module';
import { getPackageRoot } from '../utils/fs.js';

type PrettierModule = {
  format: (source: string, options?: { filepath?: string; parser?: string }) => Promise<string>;
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
    return await prettier.format(content, { filepath: indexPath, parser: 'markdown' });
  } catch {
    return content;
  }
}
