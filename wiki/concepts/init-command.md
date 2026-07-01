---
type: concept
title: Init Command
last_updated: 2026-07-01T00:00:00Z
tags: [cli, scaffold]
related: [concepts/template-system.md, concepts/repo-layout.md]
status: active
summary: How the init CLI scaffolds a wiki, AGENTS.md, npm scripts, and install config into a consumer project.
---

# Init Command

The `init` command in `src/commands/init.ts` interactively collects project settings, then scaffolds artifacts into the consumer's working directory.

## Prompts and variables

| Input             | Default                   | Used in                        |
| ----------------- | ------------------------- | ------------------------------ |
| Project name      | basename of cwd           | `AGENTS.md`, `schema.md`       |
| Wiki directory    | `wiki`                    | paths, npm script targets      |
| Focus directories | _(blank = whole project)_ | `schema.md`, `AGENTS.md` scope |

These become interpolation variables (`PROJECT_NAME`, `WIKI_DIR`, `FOCUS_DIRS`, `FOCUS_DIRS_LIST`, `INIT_TIMESTAMP`) passed to [Template System](template-system.md).

## Scaffold steps

1. **Wiki directory** — copies `templates/wiki/` via `scaffoldWikiTemplates`, creates empty dirs and optional entity overview stubs.
2. **package.json** — merges `wiki:*` npm scripts that invoke `llm-wiki-manager` subcommands (skipped if no `package.json` or scripts already exist).
3. **AGENTS.md** — amends repo-root `AGENTS.md` with a pointer to `wiki/AGENTS.md`; vault copy created from `templates/wiki/AGENTS.md`
4. **`.llm-wiki-manager.json`** — records install metadata (version, wiki dir, focus dirs).

Wiki management logic lives in the published package (`src/wiki/`), not as copied files in the consumer repo.

## Idempotency

Re-running `init` on an already-initialized project only creates missing scaffold files. It does not overwrite existing wiki content, `log.md`, or `schema.md`.

## See also

- [Template System](template-system.md)
- [Repo Layout](repo-layout.md)
