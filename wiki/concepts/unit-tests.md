---
type: concept
title: Unit Tests
last_updated: 2026-06-30
tags: [testing, vitest]
related:
  [concepts/e2e-tests.md, concepts/wiki-scripts.md, concepts/dogfooding.md, concepts/repo-layout.md]
code_refs:
  [
    vitest.config.ts,
    src/utils/fs.test.ts,
    test/helpers/wiki.ts,
    test/scripts/lint.test.ts,
    test/commands/upgrade.test.ts,
    test/scripts/dogfood-sync.test.ts,
  ]
status: active
summary: Vitest unit and integration tests for src/ utilities, CLI helpers, and wiki script behavior against templates/.
---

# Unit Tests

The package uses [Vitest](https://vitest.dev) for fast, isolated tests. Run the default suite from the repo root:

```bash
npm test
```

Configuration lives in `vitest.config.ts`: it includes `src/**/*.test.ts` and `test/**/*.test.ts`, and **excludes** `test/e2e/` (see [E2E Tests](e2e-tests.md)).

## Layout

| Path                                | Role                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `src/utils/fs.test.ts`              | Template copy, interpolation, install config, scaffold and upgrade helpers in `fs.ts` |
| `test/commands/upgrade.test.ts`     | Upgrade step orchestration, AGENTS.md managed section, page migration                 |
| `test/scripts/*.test.ts`            | Behavior of each `templates/scripts/*.mjs` script via subprocess                      |
| `test/scripts/dogfood-sync.test.ts` | Asserts `scripts/wiki/` matches interpolated `templates/scripts/`                     |
| `test/helpers/wiki.ts`              | Temp wiki dirs, frontmatter fixtures, `scriptPath()` helper                           |

Script tests invoke **template scripts** under `templates/scripts/` (not the dogfooded copy). That keeps tests aligned with what ships in the npm tarball. [Dogfooding](dogfooding.md) adds a separate sync test so the in-repo copy stays matched.

## Script test coverage

Each wiki maintenance script has a dedicated test file under `test/scripts/`:

| Test file               | Script under test                                            |
| ----------------------- | ------------------------------------------------------------ |
| `lint.test.ts`          | `lint.mjs`                                                   |
| `build-index.test.ts`   | `build-index.mjs`                                            |
| `sync-see-also.test.ts` | `sync-see-also.mjs`                                          |
| `log.test.ts`           | `log.mjs`                                                    |
| `help.test.ts`          | `help.mjs`                                                   |
| `setup-husky.test.ts`   | `setup-husky.mjs`                                            |
| `migrate-pages.test.ts` | `migrate-pages.mjs`                                          |
| `scripts.test.ts`       | Template inventory and smoke runs across all shipped scripts |

Tests use temporary wiki directories created by `makeTmpWikiDir()` and tear them down in `afterEach` hooks.

## CI and release

`npm test` runs in `release:check` before the e2e suite and wiki lint. Failures block publish validation.

## See also

- [E2E Tests](e2e-tests.md)
- [Wiki Management Scripts](wiki-scripts.md)
- [Dogfooding](dogfooding.md)
- [Repository Layout](repo-layout.md)
