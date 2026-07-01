---
type: concept
title: Node Version and @types/node Alignment
last_updated: 2026-07-01T21:00:00Z
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
summary: Node >=24 everywhere — .nvmrc, engines.node, @types/node, and CI aligned; with guardrails and a deferred multi-version test plan.
---

# Node Version and @types/node Alignment

This repo requires **Node.js 24+** everywhere. There is no separate “consumer floor” vs “dev pin” — what we document, what npm declares, and what CI runs are the same policy.

## Current policy

| Signal              | Location                      | Value              | Purpose                                                       |
| ------------------- | ----------------------------- | ------------------ | ------------------------------------------------------------- |
| Version manager pin | `.nvmrc`                      | `24`               | `nvm use` / `fnm use`; GitHub Actions `node-version-file`     |
| npm engines         | `package.json` `engines.node` | `>=24`             | Declared minimum for installs and published package consumers |
| TypeScript types    | `package.json` `@types/node`  | `^24`              | Compile-time API surface for Node 24                          |
| CI / release        | `.github/workflows/*.yml`     | Node from `.nvmrc` | All tests run on the pinned major                             |

## Why we require Node 24 (not >=18)

The project previously declared `engines.node: ">=18"` but only ever tested on Node 24. That was misleading:

- CI has a single Node version (from `.nvmrc`), not a matrix
- Runtime dependency `@clack/prompts` already requires `>= 20.12.0`
- As a personal project, widening support without testing adds maintenance cost with no benefit

Aligning everything to `>=24` makes documentation honest and matches actual practice.

## @types/node alignment

`@types/node` major versions track Node.js major versions (`@types/node@24` → Node 24 APIs, etc.).

**Rule:** `@types/node` must match the **`.nvmrc` major**, not the latest DefinitelyTyped release.

| Mismatch                            | Risk                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `@types/node@26` with `.nvmrc` `24` | TypeScript accepts Node 26 APIs that do not exist at runtime |
| `@types/node@22` with `.nvmrc` `24` | Missing types for Node 24 APIs you may legitimately use      |

TypeScript loads these types via `tsconfig.json` (`"types": ["node"]`).

## Enforcement

The [`check-node-types`](https://www.npmjs.com/package/check-node-types) dev dependency compares majors:

```bash
npm run check:node-types
# → check-node-types --source nvmrc
```

It reads `.nvmrc` and `@types/node` from `package.json`, then exits non-zero on mismatch.

**Where it runs:**

| Context                  | Command chain                                                       |
| ------------------------ | ------------------------------------------------------------------- |
| Local release validation | `npm run release:check` (first step)                                |
| CI                       | `.github/workflows/ci.yml` — after `npm ci`, before lint            |
| Release workflow         | `.github/workflows/release.yml` uses the same Node pin via `.nvmrc` |

## Dependabot

Dependabot **cannot read `.nvmrc`** when choosing npm version bumps. Without guardrails it will propose `@types/node` major upgrades (e.g. 24 → 26) that violate the alignment rule.

`.github/dependabot.yml` ignores semver-major updates for `@types/node`. Patch and minor updates within the current major still flow through normally.

## Upgrading Node

When intentionally moving to a new Node major:

1. Bump `.nvmrc`
2. Bump `engines.node` in `package.json` (e.g. `>=26`)
3. Bump `@types/node` to the matching major (e.g. `^26.0.0`)
4. Run `npm install` to refresh the lockfile
5. Update README and CONTRIBUTING
6. Run `npm run check:node-types` and `npm run release:check`

Do steps 1–3 in the same change so types, engines, and runtime never drift.

## Future: Node support matrix (deferred)

> **Status:** Not planned while this remains a personal project. Revisit if the package gains external users who need broader Node support.

When multi-version support becomes worthwhile:

1. **CI matrix** — add jobs for each supported major (e.g. 24, next LTS) in `.github/workflows/ci.yml`
2. **Widen `engines.node`** only after matrix jobs pass — e.g. `>=20` if 20 and 24 are both tested
3. **Keep `@types/node` on the lowest tested major** or adopt per-version type checking — `check-node-types` can use `--source engines` instead of `nvmrc` if `engines` becomes the canonical floor
4. **Document the matrix** in this page and README Requirements

Until then, single-version testing on `.nvmrc` is sufficient.

## See also

- [Repository Layout](repo-layout.md)
- [Dogfooding](dogfooding.md)
- [Unit Tests](unit-tests.md)
- [E2E Tests](e2e-tests.md)
