---
type: concept
title: Repository Layout
last_updated: 2026-07-01T20:30:00Z
tags: [architecture]
related:
  [
    concepts/dogfooding.md,
    concepts/init-command.md,
    concepts/node-version-and-types.md,
    concepts/template-system.md,
    concepts/unit-tests.md,
    concepts/e2e-tests.md,
  ]
status: active
summary: How src/, bin/, templates/, test/, and dogfooded wiki directories fit together in llm-wiki-manager.
---

# Repository Layout

This repo is both the **llm-wiki-manager npm package** and a **dogfooded consumer** of its own wiki workflow. See [Dogfooding](dogfooding.md) for the full picture.

## Package source

| Path                   | Role                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `bin/cli.ts`           | CLI entry; compiled to `dist/bin/cli.js`                                                                  |
| `src/commands/init.ts` | Init command implementation                                                                               |
| `src/utils/fs.ts`      | Template copy, interpolation, package.json merge, AGENTS.md amend                                         |
| `templates/`           | Published scaffold templates (shipped in npm tarball)                                                     |
| `test/`                | Vitest unit tests and e2e CLI workflow tests (see [Unit Tests](unit-tests.md), [E2E Tests](e2e-tests.md)) |
| `vitest.config.ts`     | Default test config — `src/` and `test/` except `test/e2e/`                                               |
| `vitest.e2e.config.ts` | E2e-only config with global build setup                                                                   |

## Dogfooded wiki (this repo)

| Path             | Role                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `wiki/`          | Internal LLM-maintained knowledge base                             |
| `wiki/entities/` | Flat scope overviews (see [Dogfooding](dogfooding.md))             |
| `scripts/wiki/`  | Interpolated copy of [Template System](template-system.md) scripts |
| `AGENTS.md`      | Repo-root pointer to [`wiki/AGENTS.md`](../AGENTS.md)              |
| `wiki/AGENTS.md` | Full agent instructions for maintaining this wiki                  |

Focus scope for this wiki: `src/` and `templates/` (set at init).

## Published vs committed

Only `dist/` and `templates/` ship via npm (`"files"` allowlist). Dogfooded `wiki/`, `scripts/wiki/`, and `AGENTS.md` are repo-only — consumers run [Init Command](init-command.md) to create their own.

## Toolchain

| Path                            | Role                                                   |
| ------------------------------- | ------------------------------------------------------ |
| `.nvmrc`                        | Dev/CI Node pin (currently 24)                         |
| `.github/workflows/ci.yml`      | Lint, test, wiki checks on push/PR                     |
| `.github/workflows/release.yml` | Release automation                                     |
| `.github/dependabot.yml`        | Weekly dependency PRs (with `@types/node` major guard) |

See [Node Version and @types/node Alignment](node-version-and-types.md) for how the Node pin, `@types/node`, Dependabot, and CI fit together.

## See also

- [Node Version and @types/node Alignment](node-version-and-types.md)
- [Dogfooding](dogfooding.md)
- [Init Command](init-command.md)
- [Template System](template-system.md)
- [Wiki Management Scripts](wiki-scripts.md)
- [Unit Tests](unit-tests.md)
- [E2E Tests](e2e-tests.md)
