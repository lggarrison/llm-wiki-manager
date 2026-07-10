---
type: source
title: 'Issue #66 — Init formatter choice'
last_updated: 2026-07-03T02:48:00Z
tags: [cli, init, enhancement]
related: [concepts/init-command.md, concepts/wiki-scripts.md]
status: active
summary: Feature request to let init record a formatter preference (Prettier, another tool, or none) and propagate it through install config, wiki:build, and lint-staged guidance.
---

# Issue #66 — Init formatter choice

GitHub enhancement request: https://github.com/lggarrison/llm-wiki-manager/issues/66

## Problem

Init and hook guidance assume Prettier. `wiki:build` formats `index.md` through `formatIndexMarkdown`, and the lint-staged snippet always appends `prettier --write`. Consumers with a different formatter—or no formatter—must hand-edit snippets after scaffold.

## Proposed direction

1. **Prompt / flag at init** — interactive `select` plus `--formatter` for non-interactive runs.
2. **Persist in install config** — extend `InstallConfig` with a `formatter` field (`prettier` | `<other>` | `none`); default missing field to `prettier` for existing installs.
3. **Propagate to tooling:**
   - `lint-staged-snippet.ts` emits formatter-appropriate tasks (or omits formatter step when `none`).
   - `format-index.ts` skips Prettier when `none` (or delegates to another adapter when supported).
   - Init outro and `setup-husky` guide text reference the chosen formatter.

## Acceptance criteria (from ticket)

- Install config records the choice.
- Lint-staged / hook docs match the selection.
- `wiki:build` respects `none` and non-Prettier modes appropriately.
- `--formatter` flag mirrors the interactive prompt.
- Backward compatible default for configs without `formatter`.

## See also

- [Init Command](../concepts/init-command.md)
- [Wiki Management Scripts](../concepts/wiki-scripts.md)
