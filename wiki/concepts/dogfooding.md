---
type: concept
title: Dogfooding
last_updated: 2026-06-30
tags: [dogfooding, architecture]
related: [concepts/repo-layout.md, concepts/template-system.md]
status: stable
summary: How llm-wiki-manager uses its own wiki workflow internally — scaffold, validation, and template refresh.
---

# Dogfooding

This repository is a **consumer of its own tool**. Running `init` against the repo root produced the same artifacts any other project receives — plus ongoing wiki content maintained by agents.

## What is dogfooded

| Artifact           | Path                                       | Role                                                                     |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| Wiki               | `wiki/`                                    | Internal, agent-maintained knowledge about `src/` and `templates/`       |
| Scripts            | `scripts/wiki/`                            | Interpolated copy of `templates/scripts/` (what consumers get from init) |
| Agent instructions | `AGENTS.md` (repo root) + `wiki/AGENTS.md` | Cursor agents and vault orientation                                      |
| npm scripts        | `wiki:*` in `package.json`                 | Lint, build, sync, check, and log commands                               |

These paths are **committed to git** but **not published** to npm. Consumers run [Init Command](init-command.md) to scaffold their own.

## README vs wiki

| Artifact    | Audience               | Content                                                        |
| ----------- | ---------------------- | -------------------------------------------------------------- |
| `README.md` | External users         | Install, commands, hooks, releasing                            |
| `wiki/`     | Agents and maintainers | Architecture, design rationale, compounding internal knowledge |

Do not migrate install docs into the wiki. Add concept pages when design decisions or code behavior need explanation beyond the README.

## Validation

Dogfooding is enforced, not decorative:

- **`release:check`** and **CI** run `wiki:lint` and `wiki:check`
- **pre-commit** runs `wiki:lint` when staged files include `wiki/`
- **`test/scripts/dogfood-sync.test.ts`** asserts `scripts/wiki/` matches interpolated `templates/scripts/`

## Refreshing after template changes

When editing `templates/scripts/`, refresh the dogfooded copy:

```bash
npm run build
node scripts/bootstrap-dogfood.mjs
npm test
npm run wiki:lint
npm run wiki:build
npm run wiki:check
```

The bootstrap script copies `templates/scripts/` → `scripts/wiki/` with placeholders resolved. It does **not** overwrite wiki content pages.

See [Template System](template-system.md) for how interpolation works.

## See also

- [Repository Layout](repo-layout.md)
- [Template System](template-system.md)
- [Init Command](init-command.md)
- [Wiki Management Scripts](wiki-scripts.md)
