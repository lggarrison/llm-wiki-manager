---
type: concept
title: Init Command
last_updated: 2026-06-30T00:00:00Z
tags: [cli, scaffold]
related: [concepts/template-system.md, concepts/repo-layout.md]
status: active
summary: How the init CLI scaffolds a wiki, scripts, AGENTS.md, and npm scripts into a consumer project.
---

# Init Command

The `init` command in `src/commands/init.ts` is the sole CLI entry point today. It interactively collects project settings, then scaffolds four artifacts into the consumer's working directory.

## Prompts and variables

| Input             | Default                   | Used in                        |
| ----------------- | ------------------------- | ------------------------------ |
| Project name      | basename of cwd           | `AGENTS.md`, `schema.md`       |
| Wiki directory    | `wiki`                    | paths, npm script targets      |
| Scripts directory | `scripts/wiki`            | copied script location         |
| Focus directories | _(blank = whole project)_ | `schema.md`, `AGENTS.md` scope |

These become interpolation variables (`PROJECT_NAME`, `WIKI_DIR`, `SCRIPTS_DIR`, `FOCUS_DIRS`, `FOCUS_DIRS_LIST`, `INIT_TIMESTAMP`) passed to [Template System](template-system.md).

## Scaffold steps

1. **Wiki directory** — copies `templates/wiki/` via `scaffoldWikiTemplates`, creates `concepts/`, `sources/`, `raw/` with `.gitkeep` files.
2. **Management scripts** — copies `templates/scripts/` via `scaffoldScripts` with placeholders replaced.
3. **package.json** — merges `wiki:*` npm scripts via `mergePackageJsonScripts` (skipped if no `package.json` or scripts already exist).
4. **AGENTS.md** — amends repo-root `AGENTS.md` with a pointer to `wiki/AGENTS.md`; vault copy created from `templates/wiki/AGENTS.md`

## Idempotency

Re-running `init` on an already-initialized project skips npm script merges and AGENTS.md amendments when markers already exist. Wiki and script files are created only when missing (`scaffoldWikiTemplates` / `scaffoldScripts` with `overwrite: false`).

## See also

- [Template System](template-system.md)
- [Repo Layout](repo-layout.md)
