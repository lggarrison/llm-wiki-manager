---
type: concept
title: E2E Tests
last_updated: 2026-06-30
tags: [testing, vitest, cli]
related:
  [concepts/unit-tests.md, concepts/init-command.md, concepts/dogfooding.md, entities/commands.md]
code_refs:
  [
    vitest.e2e.config.ts,
    test/e2e/cli-workflow.test.ts,
    test/e2e/global-setup.ts,
    test/helpers/cli.ts,
    dist/bin/cli.js,
  ]
status: active
summary: End-to-end CLI workflow tests that scaffold temp projects and exercise init, wiki scripts, and upgrade against the compiled binary.
---

# E2E Tests

End-to-end tests verify the **compiled CLI** against disposable project directories — the same path consumers use after `npm install`. Run them separately from unit tests:

```bash
npm run test:e2e
```

Configuration is in `vitest.e2e.config.ts`. It includes only `test/e2e/**/*.test.ts`, sets a 30s timeout, and runs `test/e2e/global-setup.ts` before any test file.

## Global setup

`global-setup.ts` runs `npm run build` once so `dist/bin/cli.js` exists. E2e tests always target the built binary, not TypeScript sources directly.

## Test file

`test/e2e/cli-workflow.test.ts` covers four workflows:

| Test                                                        | What it verifies                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Init scaffolds wiki, scripts, AGENTS.md, and install config | `init` creates expected paths, interpolates project name into schema, merges `wiki:*` npm scripts |
| Wiki scripts lint, build, and check after init              | Scaffolding scripts work on a fresh wiki with a user-added concept page                           |
| Upgrade refreshes templates and preserves user pages        | `upgrade` restores meta/scripts without overwriting user content                                  |
| Upgrade migrates legacy status values                       | Post-upgrade `migrate-pages.mjs` rewrites deprecated frontmatter (e.g. `draft` → `wip`)           |

Each test creates a temp directory with a minimal `package.json`, runs CLI commands via helpers, and cleans up in `afterEach`.

## Helpers

| File                   | Role                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `test/helpers/cli.ts`  | `runBuiltCli()` spawns `dist/bin/cli.js`; `runNodeScript()` runs scaffolded wiki scripts in a temp project |
| `test/helpers/wiki.ts` | Shared frontmatter fixtures (`fm`, `writePage`) reused by unit tests                                       |

Init invocations pass non-interactive flags (`--project-name`, `--wiki-dir`, `--scripts-dir`) so tests need no TTY input.

## CI and release

`npm run test:e2e` runs in `release:check` after unit tests and a fresh build. Together with [Unit Tests](unit-tests.md), it guards init and upgrade regressions before wiki lint.

## See also

- [Unit Tests](unit-tests.md)
- [Init Command](init-command.md)
- [Commands](../entities/commands.md)
- [Dogfooding](dogfooding.md)
