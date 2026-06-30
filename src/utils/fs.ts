import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const PACKAGE_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function templatePath(...parts: string[]): string {
  return join(PACKAGE_ROOT, 'templates', ...parts);
}

export function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function walkAndInterpolate(dir: string, vars: Record<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkAndInterpolate(full, vars);
    } else if (/\.(md|mjs|js)$/.test(full)) {
      const content = readFileSync(full, 'utf8');
      const updated = interpolate(content, vars);
      if (updated !== content) writeFileSync(full, updated, 'utf8');
    }
  }
}

export function copyTemplate(src: string, dest: string, vars: Record<string, string> = {}): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  if (Object.keys(vars).length > 0) {
    walkAndInterpolate(dest, vars);
  }
}

export function amendFile(filePath: string, section: string): boolean {
  const delimiter = '<!-- llm-wiki-manager -->';
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing.includes(delimiter)) return false; // already amended
    // Downgrade top-level heading to second-level when appending
    const appendSection = section.replace(/^# /m, '## ');
    writeFileSync(filePath, `${existing.trimEnd()}\n\n${delimiter}\n${appendSection}\n`, 'utf8');
  } else {
    writeFileSync(filePath, `${delimiter}\n${section}\n`, 'utf8');
  }
  return true;
}
