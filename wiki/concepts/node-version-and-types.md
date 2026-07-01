---
type: concept
title: Node Version and @types/node Alignment
last_updated: 2026-07-01T20:30:00Z
tags: [toolchain, typescript, ci]
related:
  [concepts/repo-layout.md, concepts/dogfooding.md, concepts/unit-tests.md, concepts/e2e-tests.md]
code_refs:
  [
    .nvmrc,
    package.json,
    tsconfig.json,
    .github/dependabot.yml,
    .github/workflows/ci.yml,
    .github/workflows/release.yml,
  ]
status: active
summary: Dev/CI Node pin via .nvmrc, published runtime floor via engines.node, and keeping @types/node aligned with the pin.
---

# Node Version and @types/node Alignment

This repo carries **two different Node version signals**. They serve different audiences and must not be conflated when choosing `@types/node`.

## Two version pins

| Signal        | Location                      | Current value | Purpose                                                                            |
| ------------- | ----------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| Dev/CI pin    | `.nvmrc`                      | `24`          | Local development (`nvm use` / `fnm use`) and GitHub Actions (`node-version-file`) |
| Runtime floor | `package.json` `engines.node` | `>=18`        | Minimum Node.js version for **npm consumers** of the published package             |

The dev pin is stricter than the consumer floor on purpose: maintainers develop and test on Node 24, while the CLI and wiki scripts remain compatible with Node 18+ at runtime.

## @types/node alignment

`@types/node` major versions track Node.js major versions (`@types/node@24` → Node 24 APIs, `@types/node@26` → Node 26 APIs, etc.).

**Rule:** `@types/node` must match the **`.nvmrc` major**, not the latest DefinitelyTyped release.

| Mismatch                            | Risk                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| `@types/node@26` with `.nvmrc` `24` | TypeScript accepts Node 26 APIs that do not exist at dev/CI runtime |
| `@types/node@22` with `.nvmrc` `24` | Missing types for Node 24 APIs you may legitimately use             |

TypeScript loads these types via `tsconfig.json` (`"types": ["node"]`). There is no compile-time link to `engines.node` — only to whatever `@types/node` version is installed.

## Enforcement

The [`check-node-types`](https://www.npmjs.com/package/check-node-types) dev dependency compares majors:

```bash
npm run check:node-types
# → check-node-types --source nvmrc
```

It reads `.nvmrc` and `@types/node` from `package.json`, then exits non-zero on mismatch with a fix command.

**Where it runs:**

| Context                  | Command chain                                                       |
| ------------------------ | ------------------------------------------------------------------- |
| Local release validation | `npm run release:check` (first step)                                |
| CI                       | `.github/workflows/ci.yml` — after `npm ci`, before lint            |
| Release workflow         | `.github/workflows/release.yml` uses the same Node pin via `.nvmrc` |

Example pass:

```
check-node-types: PASS
```

Example fail:

```
check-node-types: FAIL
  nvmrc major:         24
  @types/node major:   26

  Fix: npm install -D @types/node@^24
```

## Dependabot

Dependabot **cannot read `.nvmrc`** when choosing npm version bumps. Without guardrails it will propose `@types/node` major upgrades (e.g. 24 → 26) that violate the alignment rule.

`.github/dependabot.yml` ignores semver-major updates for `@types/node`:

```yaml
ignore:
  - dependency-name: '@types/node'
    update-types: ['version-update:semver-major']
```

Patch and minor updates within the current major (e.g. `24.13.2` → `24.x`) still flow through normally.

## Upgrading Node

When intentionally moving the dev/CI pin to a new Node major:

1. Bump `.nvmrc`
2. Bump `@types/node` to the matching major in `package.json` (e.g. `^26.0.0`)
3. Run `npm install` to refresh the lockfile
4. Update README and CONTRIBUTING if they call out a specific Node version
5. Re-evaluate the Dependabot ignore rule (keep it unless you want major bumps again)
6. Run `npm run check:node-types` and `npm run release:check`

Do both steps 1 and 2 in the same change so types and runtime never drift.

## See also

- [Repository Layout](repo-layout.md)
- [Dogfooding](dogfooding.md)
- [Unit Tests](unit-tests.md)
- [E2E Tests](e2e-tests.md)
