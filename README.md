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

| Prompt            | Default                   | Description                                     |
| ----------------- | ------------------------- | ----------------------------------------------- |
| Project name      | —                         | Used in AGENTS.md headings and schema.md        |
| Wiki directory    | `wiki`                    | Where the wiki files are created                |
| Scripts directory | `scripts/wiki`            | Where the management scripts are placed         |
| Focus directories | _(blank = whole project)_ | Directories the wiki documents, e.g. `src, api` |

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

Use **lint-staged** on pre-commit to rebuild and lint wiki pages when they are staged, and **wiki:check** on pre-push to catch a stale `index.md` before it reaches the remote.

| Hook       | Command              | Why                                                               |
| ---------- | -------------------- | ----------------------------------------------------------------- |
| pre-commit | `npx lint-staged`    | Run wiki build/lint only when staged files include `wiki/**/*.md` |
| pre-push   | `npm run wiki:check` | Verify `index.md` is current (read-only; does not modify files)   |

**1. Install Husky and lint-staged**

```bash
npm install -D husky lint-staged
```

**2. Add lint-staged config to `package.json`**

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

**3. Set `.husky/pre-commit`**

```sh
npx lint-staged
```

**4. Wire pre-push with the setup script**

```bash
npm run wiki:setup:husky
```

This appends `npm run wiki:check` to `.husky/pre-push` (or creates the hook) and prints the lint-staged snippet above. Re-running is safe — it skips hooks that are already configured.

### Minimal setup (no lint-staged)

If you do not use lint-staged, run `npm run wiki:build` and `npm run wiki:lint` manually before committing wiki changes, and add `npm run wiki:check` to pre-push (via `wiki:setup:husky` or by hand).

---

## Requirements

- Node.js 18 or later

---

## Development

```bash
git clone https://github.com/lggarrison/llm-wiki-manager.git
cd llm-wiki-manager
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

### Releasing

Day-to-day work happens on the **`develop`** branch; releases are cut from **`main`**. Releases are **automated** by a GitHub Actions workflow (`.github/workflows/release.yml`): when you push a `vX.Y.Z` tag whose commit is on `main`, the workflow runs the `release:check` gates and publishes a **GitHub Release** with auto-generated notes. You no longer run `gh release create` by hand.

Today a release means a GitHub Release only (git tag + notes on GitHub). Publishing to the **npm registry** is a separate, manual step you can add later — see [Publishing to npm](#publishing-to-npm-optional).

#### Branching model

- **`develop`** — integration branch. Feature branches merge here.
- **`main`** — release branch. Merge `develop` into `main` (via PR) when you are ready to ship, then tag.

Users install from GitHub today with:

```bash
npx github:lggarrison/llm-wiki-manager init
```

After you tag a release, they can pin a version:

```bash
npx github:lggarrison/llm-wiki-manager#v0.1.1 init
```

#### One-time setup

**GitHub**

The release workflow authenticates with the repository's built-in `GITHUB_TOKEN`, so no setup is required for the normal (tag-triggered) flow. The [GitHub CLI](https://cli.github.com/) (`gh`) is only needed for the manual fallback below:

```bash
gh auth login
```

**npm** (skip until you are ready to publish to the registry)

1. Create an [npm account](https://www.npmjs.com/signup) if you do not have one.
2. Log in from your machine:

   ```bash
   npm login
   ```

3. Confirm you are logged in as the account that should own the package:

   ```bash
   npm whoami
   ```

#### Version numbers (semver)

Use [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Bump  | When to use it                                      | Example           |
| ----- | --------------------------------------------------- | ----------------- |
| patch | Bug fixes, docs, internal changes — no new behavior | `0.1.0` → `0.1.1` |
| minor | New features that stay backward compatible          | `0.1.0` → `0.2.0` |
| major | Breaking changes (CLI flags, output, file layout)   | `0.1.0` → `1.0.0` |

While the package is `0.x.y`, treat **minor** bumps as the place for breaking changes if you prefer not to jump to `1.0.0` yet.

Tags use a `v` prefix to match npm convention: `v0.1.1` for version `0.1.1`.

#### Pre-release checklist

Run this on a clean `main` branch with all changes merged:

```bash
git checkout main
git pull
npm run release:check
```

`release:check` runs lint, format check, tests, and a production build. The release workflow runs this same command on the tagged commit, so running it locally first just gives you a faster signal — if it fails locally, the release run would fail too.

Optionally add a `CHANGELOG.md` entry describing what changed since the last release. There is no changelog file yet; creating one before the first release is a good habit. You can paste that text into the GitHub Release notes.

#### Cutting a release (normal path)

Replace `patch` with `minor` or `major` as needed. On Windows PowerShell, run each command on its own line.

```bash
# 1. Get main up to date with the changes you want to ship
git checkout main
git pull
git merge --ff-only develop        # or merge develop -> main via a PR on GitHub

# 2. (optional) Verify locally — the workflow runs this too
npm run release:check

# 3. Bump version: updates package.json + package-lock.json, commits "Release x.y.z", tags vX.Y.Z
npm version patch -m "Release %s"

# 4. Push the commit AND the tag — pushing the tag triggers the Release workflow
git push --follow-tags
```

That's it. Open the **Actions** tab to watch the run; when it succeeds, the release appears on the [Releases page](https://github.com/lggarrison/llm-wiki-manager/releases) with auto-generated notes.

#### What the release workflow does

Triggered by a pushed tag matching `v*.*.*`, the workflow:

1. **Guards the release** — fails unless the tagged commit is on `main`, and unless the tag equals `v` + the `version` in `package.json` (so a forgotten `npm version` can't ship the wrong version).
2. **Runs `npm run release:check`** — lint, format check, tests, and a production build.
3. **Creates the GitHub Release** — `gh release create "$TAG" --generate-notes`, using the built-in `GITHUB_TOKEN`.

#### Manual release (fallback)

If you ever need to create a release without the workflow (for example, the tag already exists but no release was published), use the GitHub CLI or the website.

**Option A — GitHub CLI**

```bash
gh release create v0.1.1 --title "v0.1.1" --generate-notes
```

Use the same version in the tag name as in `package.json` (with a `v` prefix).

**Option B — GitHub website**

1. Open [github.com/lggarrison/llm-wiki-manager/releases](https://github.com/lggarrison/llm-wiki-manager/releases).
2. Click **Draft a new release**.
3. Click **Choose a tag**, type `v0.1.1` (match `package.json`), and select **Create new tag on publish** if the tag is not listed yet. Target branch: `main`.
4. Set the release title to `v0.1.1`.
5. Click **Generate release notes** or write a short summary of changes.
6. Click **Publish release**.

**Verify the GitHub release**

```bash
# List releases
gh release list

# Install the tagged version (smoke test)
npx github:lggarrison/llm-wiki-manager#v0.1.1 --help
```

#### Publishing to npm (optional)

The release workflow does **not** publish to npm — it only creates the GitHub Release. Skip this section until you want the package on [npmjs.com](https://www.npmjs.com/); GitHub releases alone are enough for `npx github:...` installs. When you are ready, publish manually from the tagged commit:

```bash
npm publish
```

`prepublishOnly` rebuilds `dist/` before upload. Only `dist/` and `templates/` are published (see `"files"` in `package.json`).

**Dry run** — see what would be uploaded without publishing:

```bash
npm pack --dry-run
```

You can also generate the tarball locally:

```bash
npm pack
# produces llm-wiki-manager-0.1.0.tgz — delete it when done inspecting
```

#### What each step does

| Step                       | What happens                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm version patch`        | Sets `"version"` in `package.json` and `package-lock.json`, creates a git commit like `Release 0.1.1`, and tags it `v0.1.1`. Use `minor` or `major` instead of `patch` when appropriate.                                                                    |
| `git push --follow-tags`   | Pushes the version-bump commit and the `v0.1.1` tag together. Pushing the tag triggers the Release workflow.                                                                                                                                                |
| Release workflow           | Verifies the tag is on `main` and matches `package.json`, runs `release:check`, then creates the GitHub Release with auto-generated notes. Users can browse [Releases](https://github.com/lggarrison/llm-wiki-manager/releases) and install with `#v0.1.1`. |
| `npm publish` _(optional)_ | Uploads the package to npm so users can run `npx llm-wiki-manager` without the `github:` prefix. Not run by the workflow.                                                                                                                                   |

#### If something goes wrong

**Before pushing**

- Undo the version bump locally: `git tag -d v0.1.1` then `git reset --hard HEAD~1`.

**After pushing to GitHub**

- **Workflow failed (release:check or a guard)** — fix the issue on `main`, then either re-run the failed run from the **Actions** tab, or delete and re-push the tag: `git push origin --delete v0.1.1`, fix, re-tag, and `git push --follow-tags`.
- **Wrong tag, nobody has used it yet** — delete the remote tag (`git push origin --delete v0.1.1`), delete the GitHub Release if one was created (Releases page → release → Delete), fix locally, and re-run the release steps.
- **Tag exists but no GitHub Release** — re-run the workflow from the Actions tab, or create it manually with `gh release create v0.1.1 --generate-notes`.
- **Want it on npm too** — check out the tagged commit and run `npm publish` (see [Publishing to npm](#publishing-to-npm-optional)).

**npm-specific**

- **Published the wrong version** — npm does not allow re-publishing the same version number. Bump to a new patch (e.g. `0.1.2`), fix the issue, and publish again. Use `npm unpublish` only in rare cases within 72 hours and only if you are sure no one depends on that version ([npm unpublish policy](https://docs.npmjs.com/policies/unpublish)).

---

## License

MIT
