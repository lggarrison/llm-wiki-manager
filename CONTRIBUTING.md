# Contributing to llm-wiki-manager

Thanks for your interest in contributing! This project is a small Node.js CLI written in TypeScript (ESM). The notes below cover local setup, the branch model, and the checks your change needs to pass.

## Prerequisites

- Node.js 18 or later (`node --version`)
- npm (bundled with Node)

## Setup

```bash
git clone https://github.com/lggarrison/llm-wiki-manager.git
cd llm-wiki-manager
npm install
```

`npm install` runs the `prepare` script, which sets up Husky git hooks (local checkout only) and builds `dist/`.

## Branch model

- `develop` is the default branch and the target for all pull requests. Day-to-day development happens here.
- `main` is the release branch. Releases are cut from `main` and preserved there; it is not a target for feature PRs.

Branch off `develop`, and open your pull request against `develop`.

## Everyday commands

| Command                 | What it does                                 |
| ----------------------- | -------------------------------------------- |
| `npm run build`         | Compile TypeScript to `dist/`                |
| `npm test`              | Run the unit + script test suite (Vitest)    |
| `npm run test:e2e`      | Run the end-to-end CLI tests (builds first)  |
| `npm run lint`          | Lint with ESLint                             |
| `npm run lint:fix`      | Lint and auto-fix                            |
| `npm run format`        | Format with Prettier                         |
| `npm run format:check`  | Verify formatting without writing            |
| `npm run wiki:lint`     | Lint this repo's own dogfooded `wiki/` vault |
| `npm run wiki:build`    | Regenerate `wiki/index.md` from frontmatter  |
| `npm run release:check` | Run every gate CI runs (see below)           |

## Git hooks

Husky is configured for local development:

- **pre-commit** runs `lint-staged` (ESLint + Prettier on staged files, and wiki checks when `wiki/**` changes).
- **pre-push** runs `npm run release:check`.

Hooks are skipped automatically in CI and when the package is installed as a dependency.

## Before you open a PR

Run the full gate locally:

```bash
npm run release:check
```

This runs, in order: `lint`, `format:check`, `test`, `build`, `test:e2e`, `wiki:lint`, and `wiki:check`. The same checks run in CI.

If you edited any file under `wiki/`, also run `npm run wiki:build` and commit the regenerated `index.md` so `wiki:check` stays green.

Fill out the pull request template and keep changes focused. Maintainers: see [RELEASING.md](RELEASING.md) for how to cut a release.

## Reporting bugs and requesting features

Use the issue templates under [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE). For security-sensitive reports, see [SECURITY.md](SECURITY.md).
