---
type: concept
title: Wiki Management Scripts
last_updated: 2026-06-30
tags: [scripts, lint, maintenance]
related: [concepts/repo-layout.md, concepts/template-system.md, concepts/unit-tests.md]
status: active
summary: Node scripts copied from templates/scripts/ that validate, index, sync, and log wiki operations.
---

# Wiki Management Scripts

After [Init Command](init-command.md), management scripts live in `scripts/wiki/` (or the path chosen at init). Each is a standalone Node ESM script invoked via `npm run wiki:*` or directly with `node scripts/wiki/<name>.mjs`.

## Scripts

| Script              | npm command                 | Purpose                                                  |
| ------------------- | --------------------------- | -------------------------------------------------------- |
| `help.mjs`          | `wiki:help`                 | List commands and typical workflows                      |
| `lint.mjs`          | `wiki:lint`                 | Validate frontmatter, links, orphans; scan AGENTS.md     |
| `build-index.mjs`   | `wiki:build` / `wiki:check` | Regenerate or verify `index.md`                          |
| `sync-see-also.mjs` | `wiki:sync`                 | Add body links for `related:` frontmatter entries        |
| `log.mjs`           | `wiki:log`                  | Append ingest/query/lint/maintenance entries to `log.md` |

## Meta files excluded from page lint

`lint.mjs` and `build-index.mjs` skip `index.md`, `log.md`, and `schema.md` — these are structural/meta files, not wiki pages with frontmatter.

## Typical workflow

After editing concept pages:

```
npm run wiki:sync
npm run wiki:build
npm run wiki:lint
```

Use `wiki:check` (read-only) in CI and pre-push hooks to catch stale `index.md` without rewriting files.

## See also

- [Template System](template-system.md)
- [Repo Layout](repo-layout.md)
- [Unit Tests](unit-tests.md)
