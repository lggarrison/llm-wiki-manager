---
type: concept
title: Template System
last_updated: 2026-07-01T00:00:00Z
tags: [templates, scaffold]
related: [concepts/init-command.md, concepts/repo-layout.md, concepts/dogfooding.md]
status: active
summary: templates/ is the source of truth for wiki scaffold files; init copies and interpolates placeholders into consumer projects.
---

# Template System

Published package contents include `templates/` (see `package.json` `"files"`). The CLI resolves template paths relative to the installed package root via `templatePath()` in `src/utils/fs.ts`.

## Directory layout

```
templates/
├── wiki/       schema.md, index.md, log.md (scaffolded wiki skeleton)
└── AGENTS.md   agent instructions template
```

Wiki management logic (lint, build, sync, log, etc.) lives in `src/wiki/` and ships as compiled JavaScript in `dist/` — not as copied template scripts.

## Interpolation

`copyTemplate` and scaffold helpers recursively copy template files, then walk `.md`, `.mjs`, and `.js` files replacing `{{VAR}}` placeholders via `interpolate()`.

Common variables:

| Variable          | Example                    |
| ----------------- | -------------------------- |
| `PROJECT_NAME`    | `llm-wiki-manager`         |
| `WIKI_DIR`        | `wiki`                     |
| `FOCUS_DIRS`      | `` `src/`, `templates/` `` |
| `FOCUS_DIRS_LIST` | bullet list for schema.md  |
| `INIT_TIMESTAMP`  | UTC ISO timestamp of init  |

## Templates vs consumer output

Consumers receive **copies** of wiki templates under their chosen wiki path. npm scripts invoke `llm-wiki-manager` subcommands — no script files are vendored into consumer repos.

## See also

- [Dogfooding](dogfooding.md)
- [Init Command](init-command.md)
- [Repo Layout](repo-layout.md)
