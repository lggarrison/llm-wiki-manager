# llm-wiki-manager

[![CI](https://github.com/lggarrison/llm-wiki-manager/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/lggarrison/llm-wiki-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

## What this is, in one paragraph

The wiki implements Karpathy's LLM-Wiki pattern: a persistent, compounding knowledge base that an LLM agent owns and maintains, sitting between the team and the raw sources. It is plain markdown, doubles as an Obsidian vault, and is wired into the repo's tooling (npm scripts, a pre-commit hook, and tool-specific discovery shims) so it stays current as the code changes. Code in your app's source code remains the source of truth for behavior; wiki pages describe and cite code (via `code_refs:` frontmatter) but never duplicate it.

Scaffold and manage a persistent, LLM-maintained wiki for your project. Rather than relying on retrieval-augmented generation (RAG), this tool sets up a structured knowledge base that an LLM agent incrementally builds, cross-references, and synthesizes over time.

---

## What gets created

Running `init` scaffolds the following into your project:

```
wiki/
├── schema.md          # LLM conventions: frontmatter spec, operations, link rules
├── index.md           # Auto-generated content catalog
├── log.md             # Append-only operation log
├── concepts/          # Synthesized knowledge pages
├── sources/           # Summaries of ingested source documents
└── raw/               # Immutable source documents (never edited by the agent)

scripts/wiki/
├── lint.mjs           # Validate frontmatter, links, and structure
├── build-index.mjs    # Regenerate index.md from page frontmatter
├── help.mjs           # List wiki commands and when to run them
├── log.mjs            # Append operation entries to log.md
└── sync-see-also.mjs  # Sync related: frontmatter to body links

AGENTS.md              # Repo-root pointer to wiki/AGENTS.md (created or amended)

package.json           # wiki:* npm scripts added (when present)
```

---

## Installation

The source lives at [github.com/lggarrison/llm-wiki-manager](https://github.com/lggarrison/llm-wiki-manager).

### From GitHub (recommended for now)

Run directly without installing — npm builds the package from source on install:

```bash
npx github:lggarrison/llm-wiki-manager init
```

Or add it as a dev dependency in your project:

```bash
npm install --save-dev github:lggarrison/llm-wiki-manager
npx llm-wiki-manager init
```

If your machine is set up with a GitHub SSH key, you can use the SSH form instead:

```bash
npm install --save-dev git+ssh://git@github.com/lggarrison/llm-wiki-manager.git
```

### From npm (once published)

```bash
npx llm-wiki-manager init
```

### From a local clone

```bash
git clone https://github.com/lggarrison/llm-wiki-manager.git
cd llm-wiki-manager
npm install
npm run build
npm link            # makes `llm-wiki-manager` available globally

# then, from your target project:
llm-wiki-manager init
```

---

## Initializing the wiki

From the root of your project, run:

```bash
npx llm-wiki-manager init
```

You will be prompted for:

| Prompt            | Default                    | Description                                     |
| ----------------- | -------------------------- | ----------------------------------------------- |
| Project name      | _(current directory name)_ | Used in AGENTS.md headings and schema.md        |
| Wiki directory    | `wiki`                     | Where the wiki files are created                |
| Scripts directory | `scripts/wiki`             | Where the management scripts are placed         |
| Focus directories | _(blank = whole project)_  | Directories the wiki documents, e.g. `src, api` |

To skip prompts (CI, scripts, or non-interactive shells), pass `--project-name` and optionally the other flags:

```bash
npx llm-wiki-manager init \
  --project-name my-app \
  --wiki-dir wiki \
  --scripts-dir scripts/wiki \
  --focus-dirs src,api
```

`--project-name` is required to skip prompts. `--wiki-dir`, `--scripts-dir`, and `--focus-dirs` default to the values in the table above.

After `init` completes:

1. Open `wiki/schema.md` to review the conventions your agent will follow
2. Point your LLM agent at `AGENTS.md` (repo root) — it directs to `wiki/AGENTS.md` for full instructions
3. Run `npm run wiki:lint` to confirm the scaffold is valid

If your project has no `package.json`, use the raw script paths under `scripts/wiki/` instead (see [Managing the wiki](#managing-the-wiki)).

Re-running `init` on an existing project is safe: it only creates missing scaffold files and does not overwrite your wiki content or `log.md`. To refresh template files (scripts, `schema.md`, `wiki/AGENTS.md`, root `AGENTS.md`) after updating the package, use **upgrade**:

```bash
npx llm-wiki-manager upgrade
npx llm-wiki-manager upgrade --dry-run   # preview changes
```

Install metadata is stored in `.llm-wiki-manager.json` at the project root.

---

## Updating the wiki

### Ingesting a new source document

Place the raw document (article, spec, transcript, etc.) into `wiki/raw/`, then ask your agent to ingest it. The agent will:

1. Read the raw document and discuss key takeaways
2. Create a summary page in `wiki/sources/`
3. Create or update concept pages in `wiki/concepts/`
4. Add cross-references between related pages

After the agent finishes, run the maintenance scripts:

```bash
npm run wiki:sync                     # sync related: links to page bodies
npm run wiki:build                    # regenerate index.md
npm run wiki:log -- add ingest "Title of source"
```

### Querying the wiki

Ask your agent a question. It will read `wiki/index.md` to locate relevant pages, then synthesize an answer with citations. If the query reveals a gap, the agent should create a stub page (`status: draft`) to track it.

```bash
npm run wiki:log -- add query "Summary of the question"
```

### Editing pages manually

- Update `last_updated` in the frontmatter whenever you change a page
- Run `npm run wiki:build` after adding or removing pages
- Run `npm run wiki:lint` to catch any broken links or missing fields

---

## Managing the wiki

When `init` finds a `package.json`, it adds these npm scripts. Run `npm run wiki:help` anytime for a quick reference.

| Script             | Command                                     | Purpose                                           |
| ------------------ | ------------------------------------------- | ------------------------------------------------- |
| `wiki:help`        | `node scripts/wiki/help.mjs`                | List commands, usage, and when to run them        |
| `wiki:lint`        | `node scripts/wiki/lint.mjs`                | Validate frontmatter, links, and structure        |
| `wiki:build`       | `node scripts/wiki/build-index.mjs`         | Regenerate `index.md`                             |
| `wiki:check`       | `node scripts/wiki/build-index.mjs --check` | Verify `index.md` is up to date (read-only)       |
| `wiki:sync`        | `node scripts/wiki/sync-see-also.mjs`       | Sync `related:` frontmatter to body links         |
| `wiki:log`         | `node scripts/wiki/log.mjs`                 | Append operation entries to `log.md`              |
| `wiki:setup:husky` | `node scripts/wiki/setup-husky.mjs`         | Wire pre-push wiki:check; print lint-staged guide |

### Lint — validate structure

```bash
npm run wiki:lint
```

Checks for:

- Missing or invalid frontmatter fields
- `related:` paths that don't resolve to existing files
- Broken markdown links in page bodies
- Wikilinks (`[[...]]`) that should be markdown links
- `related:` entries with no corresponding body link
- Orphaned pages (no other page links to them)
- Stale wiki references in AGENTS.md

Options:

```bash
node scripts/wiki/lint.mjs --warn-only          # report errors without exiting 1
node scripts/wiki/lint.mjs --wiki-dir path/to/wiki
```

### Build index — regenerate index.md

```bash
npm run wiki:build
```

Walks all wiki pages, reads their frontmatter, and writes a fresh `index.md` grouped by page type (overview/hub → concepts → sources). Run this any time pages are added, removed, or renamed.

Options:

```bash
npm run wiki:build -- --wiki-dir path/to/wiki
node scripts/wiki/build-index.mjs --wiki-dir path/to/wiki   # without npm scripts
```

### Check index — verify index.md is current

```bash
npm run wiki:check
```

Compares the existing `index.md` to what `wiki:build` would produce. Exits with code 1 if stale. Useful in pre-push hooks and CI because it does not modify files.

Options:

```bash
npm run wiki:check -- --wiki-dir path/to/wiki
```

### Log — record operations

```bash
npm run wiki:log -- add <op> "<title>"
```

Operations: `ingest`, `query`, `lint`, `maintenance`

Examples:

```bash
npm run wiki:log -- add ingest "RFC 9110 HTTP Semantics"
npm run wiki:log -- add query "How does auth token refresh work?"
npm run wiki:log -- add lint "weekly health check"
npm run wiki:log -- add maintenance "archived three stale pages"

# Backdate an entry
npm run wiki:log -- add ingest "Old doc" --date=2025-01-15
```

Options:

```bash
npm run wiki:log -- add <op> "<title>" --wiki-dir path/to/wiki
node scripts/wiki/log.mjs add <op> "<title>" --wiki-dir path/to/wiki   # without npm scripts
```

### Sync see-also — fix missing body links

```bash
npm run wiki:sync
```

For every `related:` entry in a page's frontmatter that lacks a corresponding markdown link in the body, appends the missing link under a `## See also` section. This keeps the wiki graph consistent.

Options:

```bash
npm run wiki:sync -- --dry            # preview changes without writing
npm run wiki:sync -- --wiki-dir path/to/wiki
node scripts/wiki/sync-see-also.mjs --wiki-dir path/to/wiki   # without npm scripts
```

---

## Wiki page conventions

Every wiki page must have YAML frontmatter:

```yaml
---
type: concept # concept | source | overview | hub
title: 'Page Title'
last_updated: 2025-06-30T00:00:00Z
tags: [auth, api]
related: [] # relative paths from wiki root
status: draft # draft | stable | archived
---
```

- Place pages in the directory matching their type: `concepts/`, `sources/`, or wiki root (overview/hub)
- Use markdown links `[Title](path.md)` — never wikilinks `[[...]]`
- Every path in `related:` must also appear as a body link (run `npm run wiki:sync` to auto-add)
- See `wiki/schema.md` for the full specification

---

## Optional git hooks

`init` does not install git hooks in your project — it only adds npm scripts when `package.json` exists. You can wire up hooks yourself if you want automated wiki checks.

### Recommended setup (Husky + lint-staged)

| Hook       | Command              | Why                                                               |
| ---------- | -------------------- | ----------------------------------------------------------------- |
| pre-push   | `npm run wiki:check` | Verify `index.md` is current (read-only; does not modify files)   |
| pre-commit | `npx lint-staged`    | Run wiki build/lint only when staged files include `wiki/**/*.md` |

**1. Install dependencies**

```bash
npm install -D husky lint-staged prettier
```

**2. Pre-push — initialize Husky and wire `wiki:check`**

```bash
npm run wiki:setup:husky
```

This activates Husky, creates `.husky/` if needed, and adds `npm run wiki:check` to `.husky/pre-push` (or appends it when the hook already exists). Re-running is safe — it skips hooks that are already configured.

If you prefer to do it by hand, create `.husky/pre-push` with:

```sh
npm run wiki:check
```

**3. Pre-commit — add lint-staged config to `package.json`**

```json
"lint-staged": {
  "wiki/**/*.md": [
    "npm run wiki:build",
    "npm run wiki:lint",
    "prettier --write"
  ]
}
```

Adjust the glob if your wiki directory is not `wiki/`. lint-staged re-stages any files modified by these tasks (including regenerated `wiki/index.md`).

**4. Pre-commit — create `.husky/pre-commit`**

```sh
npx lint-staged
```

### Minimal setup (no lint-staged)

Run `npm run wiki:setup:husky` for pre-push only. Before committing wiki changes, run `npm run wiki:build` and `npm run wiki:lint` manually instead of using lint-staged.

---

## Requirements

- Node.js 18 or later (to run the CLI and wiki scripts)
- Node.js 24 for local development — use [`.nvmrc`](.nvmrc) (`nvm use` / `fnm use`)

---

## Development

```bash
git clone https://github.com/lggarrison/llm-wiki-manager.git
cd llm-wiki-manager
nvm use              # or: fnm use  (Node 24 — see .nvmrc)
npm install          # also sets up Husky git hooks and builds dist/
npm run build        # compile TypeScript to dist/
npm test             # run the vitest suite
npm run lint         # check with ESLint
npm run lint:fix     # auto-fix ESLint issues
npm run format       # format with Prettier
npm run format:check # verify formatting without writing
```

The compiled CLI entry point is `dist/bin/cli.js` (built from `bin/cli.ts`). The `prepare` script sets up Husky and runs the build automatically on install and before publishing, so `dist/` is always present in the published package.

### Internal wiki

This repo dogfoods its own wiki workflow. Internal knowledge about `src/` and `templates/` lives in:

- [`wiki/index.md`](wiki/index.md) — auto-generated page catalog
- [`wiki/AGENTS.md`](wiki/AGENTS.md) — agent instructions (`AGENTS.md` at repo root points here)

Run `npm run wiki:help` for wiki commands. CI and `release:check` run `wiki:lint` and `wiki:check`.

### Refreshing dogfooded scaffold

When you change files under `templates/scripts/`, refresh the dogfooded copy and verify sync:

```bash
npm run build
node scripts/bootstrap-dogfood.mjs
npm test                    # includes templates/scripts ↔ scripts/wiki sync test
npm run wiki:lint
npm run wiki:build
npm run wiki:check
```

The bootstrap script copies `templates/scripts/` into `scripts/wiki/` with placeholders resolved. It does not overwrite wiki content pages.

### Code quality & git hooks

This repo uses [ESLint](https://eslint.org), [Prettier](https://prettier.io), and [Husky](https://typicode.github.io/husky/) with [lint-staged](https://github.com/lint-staged/lint-staged):

- **pre-commit** — `npx lint-staged` (wiki pages run `wiki:build`, `wiki:lint`, and Prettier via `package.json`)
- **pre-push** — `npm run release:check` (lint, format, tests, build, and wiki checks)

Husky is only installed in the local development repo; it is skipped automatically in CI, production installs, and when the package is consumed as a dependency.

Issues and pull requests are welcome at [github.com/lggarrison/llm-wiki-manager](https://github.com/lggarrison/llm-wiki-manager/issues).

### Releases

Version tags are published as [GitHub Releases](https://github.com/lggarrison/llm-wiki-manager/releases). Pin a specific version:

```bash
npx github:lggarrison/llm-wiki-manager#v0.1.1 init
```

Release history is in [CHANGELOG.md](CHANGELOG.md). Maintainers: see [RELEASING.md](RELEASING.md) for the full cut-a-release runbook.

---

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the branch model, and how to open a pull request. Release history is in [CHANGELOG.md](CHANGELOG.md); maintainers see [RELEASING.md](RELEASING.md). To report a security issue privately, see [SECURITY.md](SECURITY.md).
