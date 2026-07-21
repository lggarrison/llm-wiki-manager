const LINK_LABEL_ESCAPES: Record<string, string> = {
  '[': '&#91;',
  ']': '&#93;',
};

export function escapeMarkdownLinkLabel(label: string): string {
  return label.replace(/\[|\]/g, (char) => LINK_LABEL_ESCAPES[char] ?? char);
}

export function markdownLink(label: string, href: string): string {
  return `[${escapeMarkdownLinkLabel(label)}](${href})`;
}
