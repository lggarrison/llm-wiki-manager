---
type: concept
title: Dogfooding
last_updated: 2026-07-01T00:00:00Z
tags: [dogfooding, architecture]
related:
  [
    concepts/repo-layout.md,
    concepts/node-version-and-types.md,
    concepts/template-system.md,
    concepts/unit-tests.md,
  ]
status: active
summary: How llm-wiki-manager uses its own wiki workflow internally — scaffold, validation, and template refresh.
---

# Dogfooding

This repository is a **consumer of its own tool**. Running `init` against the repo root produced the same artifacts any other project receives — plus ongoing wiki content maintained by agents.

## What is dogfooded

| Artifact           | Path                                                       | Role                                                               |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Wiki               | `wiki/`                                                    | Internal, agent-maintained knowledge about `src/` and `templates/` |
| Agent instructions | `AGENTS.md` (repo root) → [`wiki/AGENTS.md`](../AGENTS.md) | Repo root pointer; vault holds full agent rules                    |
| npm scripts        | `wiki:*` in `package.json`                                 | Invoke `llm-wiki-manager` lint, build, sync, check, and log        |

These paths are **committed to git** but **not published** to npm. Consumers run [Init Command](init-command.md) to scaffold their own.

## README vs wiki

| Artifact       | Audience               | Content                                                        |
| -------------- | ---------------------- | -------------------------------------------------------------- |
| `README.md`    | External users         | Install, commands, hooks                                       |
| `RELEASING.md` | Maintainers            | Cut-a-release runbook (semver, tagging, npm, troubleshooting)  |
| `wiki/`        | Agents and maintainers | Architecture, design rationale, compounding internal knowledge |

Do not migrate install docs into the wiki. Add concept pages when design decisions or code behavior need explanation beyond the README.

## Validation

Dogfooding is enforced, not decorative:

- **`release:check`** and **CI** run `check:node-types`, then `wiki:lint` and `wiki:check` (see [Node Version and @types/node Alignment](node-version-and-types.md))
- **pre-commit** runs `wiki:lint` when staged files include `wiki/`
- **`test/scripts/*.test.ts`** exercise CLI subcommands via the built `dist/bin/cli.js`
- **`test/e2e/tarball-smoke.test.ts`** verifies subcommands work from an npm-packed install

## Refreshing after template changes

When `templates/wiki/` or `templates/AGENTS.md` change — or you want the same end-to-end refresh a consumer gets after updating the package — run **upgrade** from the **repo root**:

```bash
npm run build
node dist/bin/cli.js upgrade
```

Preview changes first:

```bash
node dist/bin/cli.js upgrade --dry-run
```

Upgrade refreshes scaffold files without touching wiki content:

| Refreshed                          | Preserved                                         |
| ---------------------------------- | ------------------------------------------------- |
| `wiki/schema.md`, `wiki/AGENTS.md` | `wiki/entities/`, `concepts/`, `sources/`, `raw/` |
| Root `AGENTS.md` managed section   | `wiki/log.md` (appended to, not overwritten)      |
| `package.json` `wiki:*` scripts    |                                                   |

It also runs post-upgrade steps (page migration, sync, build, warn-only lint) and appends an entry to `wiki/log.md`. Paths are read from `.llm-wiki-manager.json` when present; otherwise inferred from `wiki/schema.md`, root `AGENTS.md`, and `package.json`.

Optional flag: `--skip-pages`.

Package updates for wiki logic itself happen via `npm update llm-wiki-manager` — no script vendoring step.

See [Template System](template-system.md) for how interpolation works.

## See also

- [Repository Layout](repo-layout.md)
- [Node Version and @types/node Alignment](node-version-and-types.md)
- [Template System](template-system.md)
- [Init Command](init-command.md)
- [Wiki Management Scripts](wiki-scripts.md)
- [Unit Tests](unit-tests.md)
