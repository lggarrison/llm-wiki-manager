export type Frontmatter = Record<string, string | string[]>;

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseInlineArray(raw: string): string[] {
  return raw
    .slice(1, -1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function blockScalarStyle(raw: string): 'literal' | 'folded' | null {
  if (!/^[|>](?:[+-]?\d*|\d+[+-]?)$/.test(raw)) return null;
  return raw.startsWith('|') ? 'literal' : 'folded';
}

function readIndentedBlock(lines: string[], start: number): { value: string; next: number } {
  const blockLines: string[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() !== '' && !/^\s/.test(line)) break;
    blockLines.push(line);
    i++;
  }

  const indents = blockLines
    .filter((line) => line.trim() !== '')
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  const unindented = blockLines.map((line) => (line.trim() === '' ? '' : line.slice(indent)));

  // Frontmatter scalar fields are consumed as single-line metadata values by
  // build/sync output. Collapse block scalar whitespace so marker syntax cannot
  // leak into generated markdown tables or link labels.
  return { value: unindented.join('\n').replace(/\s+/g, ' ').trim(), next: i };
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

    if (blockScalarStyle(raw)) {
      const block = readIndentedBlock(lines, i + 1);
      fm[key] = block.value;
      i = block.next - 1;
      continue;
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
 * Find frontmatter keys written as block/folded scalar YAML ("|" or ">"
 * markers). The wiki schema expects single-line scalar values and inline
 * arrays; accepting block scalars silently can corrupt generated markdown.
 */
export function detectBlockScalarKeys(content: string): string[] {
  const match = content.match(FM_BLOCK);
  if (!match) return [];
  const keys: string[] = [];
  const lines = match[1].split('\n');
  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*([|>](?:[+-]?\d*|\d+[+-]?))\s*$/);
    if (keyMatch) keys.push(keyMatch[1]);
  }
  return keys;
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
