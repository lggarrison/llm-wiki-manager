export const RAW_ARTIFACT_DIRS = [
  'articles',
  'prs',
  'tickets',
  'design-notes',
  'transcripts',
  'assets',
] as const;

export const VALID_TYPES = new Set([
  'overview',
  'entity',
  'comparison',
  'deep-dive',
  'concept',
  'source',
  'hub',
]);

export const VALID_STATUSES = new Set(['active', 'deprecated', 'wip']);

export const REQUIRED_FIELDS = ['type', 'title', 'last_updated'];

export const ENTITY_TYPES = new Set(['overview', 'entity', 'comparison', 'deep-dive']);

export const HUB_PATHS = new Set(['README.md', 'index.md', 'raw/raw.md']);

export const KEBAB_MD = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;

export const TYPE_PLACEMENT: Record<string, RegExp> = {
  overview: /^entities\/[^/]+\.md$/,
  entity: /^entities\/[^/]+\.md$/,
  comparison: /^entities\/[^/]+\.md$/,
  'deep-dive': /^entities\/[^/]+\.md$/,
  concept: /^concepts\/[^/]+\.md$/,
  source: /^sources\/[^/]+\.md$/,
  hub: /^(README\.md|index\.md|raw\/raw\.md)$/,
};

export const META_SKIP = new Set(['index.md', 'log.md', 'schema.md', 'README.md', 'AGENTS.md']);

export function isRootMetaPath(relPath: string): boolean {
  return META_SKIP.has(relPath.replace(/\\/g, '/'));
}
