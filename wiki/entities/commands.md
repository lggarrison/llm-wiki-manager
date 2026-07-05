---
type: overview
title: Commands
last_updated: 2026-07-05T11:07:00Z
tags: [commands]
related:
  [entities/utils.md, concepts/init-command.md, concepts/dogfooding.md, concepts/wiki-scripts.md]
code_refs: [src/commands/init.ts, src/commands/upgrade.ts]
status: active
summary: Overview of src/commands/ — CLI command implementations.
---

# Commands (`src/commands/`)

Scope tag: **`commands`** (first tag).

| File         | Role                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `init.ts`    | Interactive or flag-driven wiki scaffold (see [Init Command](../concepts/init-command.md))                                   |
| `upgrade.ts` | Preflights local package version, refreshes templates, syncs npm scripts, migrates pages, and runs the post-upgrade pipeline |

## Init flags

Non-interactive init (used in tests and CI):

| Flag             | Required |
| ---------------- | -------- |
| `--project-name` | yes      |
| `--wiki-dir`     | no       |
| `--focus-dirs`   | no       |

## Upgrade flags

| Flag           | Effect                               |
| -------------- | ------------------------------------ |
| `--dry-run`    | Report changes without writing files |
| `--skip-pages` | Skip page migration step             |

Upgrade orchestration helpers live in `src/utils/upgrade.ts`.

Upgrade refuses to run when `node_modules` contains a newer `llm-wiki-manager` than the invoked CLI, preventing older templates from overwriting a newer scaffold.

## See also

- [Init Command](../concepts/init-command.md)
- [Dogfooding](../concepts/dogfooding.md)
- [Wiki Management Scripts](../concepts/wiki-scripts.md)
- [Utils](utils.md)
