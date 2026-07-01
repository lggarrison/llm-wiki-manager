---
type: concept
title: Template System
last_updated: 2026-06-30T00:00:00Z
tags: [templates, scaffold]
related: [concepts/init-command.md, concepts/repo-layout.md, concepts/dogfooding.md]
status: active
summary: templates/ is the source of truth; init copies and interpolates placeholders into consumer projects.
---

# Template System

Published package contents include `templates/` (see `package.json` `"files"`). The CLI resolves template paths relative to the installed package root via `templatePath()` in `src/utils/fs.ts`.

## Directory layout

```
templates/
├── wiki/       schema.md, index.md, log.md (scaffolded wiki skeleton)
├── scripts/    lint, build-index, sync-see-also, log, help (.mjs)
└── AGENTS.md   agent instructions template
```

## Interpolation

`copyTemplate` recursively copies a template directory, then walks `.md`, `.mjs`, and `.js` files replacing `{{VAR}}` placeholders via `interpolate()`.

Common variables:

| Variable          | Example                    |
| ----------------- | -------------------------- |
| `PROJECT_NAME`    | `llm-wiki-manager`         |
| `WIKI_DIR`        | `wiki`                     |
| `SCRIPTS_DIR`     | `scripts/wiki`             |
| `FOCUS_DIRS`      | `` `src/`, `templates/` `` |
| `FOCUS_DIRS_LIST` | bullet list for schema.md  |
| `INIT_DATE`       | UTC ISO timestamp of init  |

## Templates vs dogfooded output

Consumers receive **copies** under their chosen wiki and scripts paths. In this repo, `scripts/wiki/` is the dogfooded copy of `templates/scripts/` (with placeholders already resolved). When editing templates, refresh the dogfooded copy so they stay in sync — see [Dogfooding](dogfooding.md).

## See also

- [Dogfooding](dogfooding.md)
- [Init Command](init-command.md)
- [Repo Layout](repo-layout.md)
