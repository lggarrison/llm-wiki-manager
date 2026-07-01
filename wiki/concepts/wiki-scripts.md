---
type: concept
title: Wiki Management Scripts
last_updated: 2026-07-01T00:00:00Z
tags: [scripts, lint, maintenance]
related:
  [concepts/repo-layout.md, concepts/template-system.md, concepts/unit-tests.md, entities/cli.md]
status: active
summary: llm-wiki-manager CLI subcommands that validate, index, sync, and log wiki operations.
---

# Wiki Management Scripts

After [Init Command](init-command.md), `package.json` gains `wiki:*` npm scripts that delegate to `llm-wiki-manager` subcommands. Implementation lives in `src/wiki/` inside the package — nothing is copied into consumer projects.

## Commands

| CLI subcommand | npm command        | Purpose                                                  |
| -------------- | ------------------ | -------------------------------------------------------- |
| `help`         | `wiki:help`        | List commands and typical workflows                      |
| `lint`         | `wiki:lint`        | Validate frontmatter, links, orphans; scan AGENTS.md     |
| `build`        | `wiki:build`       | Regenerate `index.md`                                    |
| `check`        | `wiki:check`       | Verify `index.md` is up to date (read-only)              |
| `sync`         | `wiki:sync`        | Add body links for `related:` frontmatter entries        |
| `log`          | `wiki:log`         | Append ingest/query/lint/maintenance entries to `log.md` |
| `setup-husky`  | `wiki:setup:husky` | Wire pre-push `wiki:check`; print lint-staged guide      |

`migrate-pages` runs internally during `upgrade` — not exposed as a public subcommand.

## Path resolution

Subcommands resolve the wiki directory from `--wiki-dir`, then `.llm-wiki-manager.json`, then root `AGENTS.md`, defaulting to `wiki/`. All paths are relative to the consumer's project root (`process.cwd()`).

## Meta files excluded from page lint

`lint` and `build` skip `index.md`, `log.md`, and `schema.md` — these are structural/meta files, not wiki pages with frontmatter.

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
- [CLI](../entities/cli.md)
