export type Frontmatter = Record<string, string | string[]>;

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseInlineArray(raw: string): string[] {
  return raw
    .slice(1, -1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseFrontmatter(content: string): Frontmatter | null {
  const match = content.match(FM_BLOCK);
  if (!match) return null;
  const fm: Frontmatter = {};
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let raw = line.slice(colon + 1).trim();

    // Prettier wraps long inline arrays onto the following line(s):
    //   related:
    //     [a.md, b.md]
    // Join those continuation lines back into a single inline array.
    if (raw === '' && lines[i + 1]?.trim().startsWith('[')) {
      i++;
      raw = lines[i].trim();
      while (!raw.endsWith(']') && i + 1 < lines.length) {
        i++;
        raw = `${raw} ${lines[i].trim()}`;
      }
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      fm[key] = parseInlineArray(raw);
    } else {
      fm[key] = raw.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

/**
 * Find frontmatter keys written as block-style YAML lists ("- item" lines),
 * which the line-based parser above cannot represent. Lint reports these so
 * they fail loudly instead of being silently ignored.
 */
export function detectBlockListKeys(content: string): string[] {
  const match = content.match(FM_BLOCK);
  if (!match) return [];
  const keys: string[] = [];
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const keyMatch = lines[i].match(/^([A-Za-z0-9_-]+):\s*$/);
    if (keyMatch && /^\s*-\s+\S/.test(lines[i + 1])) {
      keys.push(keyMatch[1]);
    }
  }
  return keys;
}
