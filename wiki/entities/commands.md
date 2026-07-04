---
type: overview
title: Commands
last_updated: 2026-07-04T11:08:00Z
tags: [commands]
related:
  [entities/utils.md, concepts/init-command.md, concepts/dogfooding.md, concepts/wiki-scripts.md]
code_refs: [src/commands/init.ts, src/commands/upgrade.ts]
status: active
summary: Overview of src/commands/ — CLI command implementations.
---

# Commands (`src/commands/`)

Scope tag: **`commands`** (first tag).

| File         | Role                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init.ts`    | Interactive or flag-driven wiki scaffold (see [Init Command](../concepts/init-command.md))                                                                          |
| `upgrade.ts` | Refresh templates, sync npm scripts, migrate pages, post-upgrade pipeline; refuses to run from a CLI older than the recorded scaffold version before mutating files |

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

## See also

- [Init Command](../concepts/init-command.md)
- [Dogfooding](../concepts/dogfooding.md)
- [Wiki Management Scripts](../concepts/wiki-scripts.md)
- [Utils](utils.md)
