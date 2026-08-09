---
type: overview
title: Commands
last_updated: 2026-08-09T11:01:18Z
tags: [commands]
related:
  [entities/utils.md, concepts/init-command.md, concepts/dogfooding.md, concepts/wiki-scripts.md]
code_refs: [src/commands/init.ts, src/commands/upgrade.ts]
status: active
summary: Overview of src/commands/ — CLI command implementations.
---

# Commands (`src/commands/`)

Scope tag: **`commands`** (first tag).

| File         | Role                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init.ts`    | Interactive or flag-driven wiki scaffold (see [Init Command](../concepts/init-command.md))                                                          |
| `upgrade.ts` | Refresh templates, sync npm scripts, migrate pages, post-upgrade pipeline; outro reminds `npm install` when local bin is missing (parity with init) |

## Init flags

Non-interactive init (used in tests and CI):

| Flag             | Required |
| ---------------- | -------- |
| `--project-name` | yes      |
| `--wiki-dir`     | no       |
| `--focus-dirs`   | no       |

The non-interactive parser fails fast on unknown options and missing values that look like flags before any scaffold files are written.

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
