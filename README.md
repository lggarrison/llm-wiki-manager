# llm-wiki-manager

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

AGENTS.md              # Generic agent instructions (created or amended)

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

After `init` completes:

1. Open `wiki/schema.md` to review the conventions your agent will follow
2. Share `AGENTS.md` with your LLM agent (or point it to the file)
3. Run `npm run wiki:lint` to confirm the scaffold is valid

If your project has no `package.json`, use the raw script paths under `scripts/wiki/` instead (see [Managing the wiki](#managing-the-wiki)).

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

| Script       | Command                                     | Purpose                                     |
| ------------ | ------------------------------------------- | ------------------------------------------- |
| `wiki:help`  | `node scripts/wiki/help.mjs`                | List commands, usage, and when to run them  |
| `wiki:lint`  | `node scripts/wiki/lint.mjs`                | Validate frontmatter, links, and structure  |
| `wiki:build` | `node scripts/wiki/build-index.mjs`         | Regenerate `index.md`                       |
| `wiki:check` | `node scripts/wiki/build-index.mjs --check` | Verify `index.md` is up to date (read-only) |
| `wiki:sync`  | `node scripts/wiki/sync-see-also.mjs`       | Sync `related:` frontmatter to body links   |
| `wiki:log`   | `node scripts/wiki/log.mjs`                 | Append operation entries to `log.md`        |

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
last_updated: 2025-06-30
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

**Recommended pattern:** lint on commit (read-only), check index on push (read-only).

| Hook       | Command              | Why                                                           |
| ---------- | -------------------- | ------------------------------------------------------------- |
| pre-commit | `npm run wiki:lint`  | Catch broken links and invalid frontmatter before commit      |
| pre-push   | `npm run wiki:check` | Ensure `index.md` matches current pages without writing files |

Run `npm run wiki:build` manually (or via your agent workflow) after adding, removing, or renaming pages — it writes `index.md`, so it belongs in the edit workflow rather than as a silent pre-commit step.

### Scoped pre-commit (only when wiki files change)

Append to an existing `.husky/pre-commit` (or equivalent):

```sh
git diff --cached --name-only --diff-filter=ACM | grep -q '^wiki/' && npm run wiki:lint
```

Replace `^wiki/` with your wiki directory if you chose a non-default name at init.

### Pre-push index check

Append to an existing `.husky/pre-push`:

```sh
npm run wiki:check
```

These snippets use npm scripts and work cross-platform (including Windows/PowerShell).

### Advanced: lint-staged

If your project already uses [lint-staged](https://github.com/lint-staged/lint-staged), you can optionally add:

```json
"wiki/**/*.md": ["npm run wiki:build", "npm run wiki:lint"]
```

lint-staged re-stages any files modified by these tasks (including regenerated `index.md`).

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

### Code quality & git hooks

This repo uses [ESLint](https://eslint.org), [Prettier](https://prettier.io), and [Husky](https://typicode.github.io/husky/) with [lint-staged](https://github.com/lint-staged/lint-staged):

- **pre-commit** — runs `lint-staged`, applying `eslint --fix` and `prettier --write` to staged files
- **pre-push** — runs the full test suite (`npm test`)

Husky is only installed in the local development repo; it is skipped automatically in CI, production installs, and when the package is consumed as a dependency.

Issues and pull requests are welcome at [github.com/lggarrison/llm-wiki-manager](https://github.com/lggarrison/llm-wiki-manager/issues).

### Releasing

A release has two parts: a **GitHub release** (git tag + release notes on GitHub) and an **npm publish** (package on the npm registry). You can do both together or ship to GitHub first and publish to npm later.

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

1. Install the [GitHub CLI](https://cli.github.com/) (`gh`) for terminal releases, or use the GitHub website (steps below).
2. Authenticate once:

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

`release:check` runs lint, format check, tests, and a production build — the same gates as CI (`pre-push` runs tests; lint/format are enforced on commit).

Optionally add a `CHANGELOG.md` entry describing what changed since the last release. There is no changelog file yet; creating one before the first release is a good habit. You can paste that text into the GitHub Release notes.

#### Release script (copy and adapt)

Replace `patch` with `minor` or `major` as needed. On Windows PowerShell 7+, `&&` works as shown; on older PowerShell, run each command on its own line.

```bash
# 1. Verify everything passes
npm run release:check

# 2. Bump version — updates package.json + package-lock.json, commits, and tags (e.g. v0.1.1)
npm version patch -m "Release %s"

# 3. Push the commit and tag to GitHub
git push origin main
git push origin --tags

# 4. Create a GitHub Release from the tag (see "GitHub Release" below for the web UI alternative)
gh release create v0.1.1 --title "v0.1.1" --generate-notes

# 5. (When ready) Publish to npm — prepublishOnly runs `npm run build` automatically
npm publish
```

After the first npm publish, update the [Installation](#installation) section if you want to highlight the npm install path as the default.

#### GitHub Release

A **git tag** marks the exact commit for a version. A **GitHub Release** attaches human-readable notes to that tag on the [Releases page](https://github.com/lggarrison/llm-wiki-manager/releases). Step 2 (`npm version`) creates the tag locally; step 3 pushes it; step 4 publishes the release.

**Option A — GitHub CLI (recommended)**

```bash
# Auto-generate notes from merged PRs since the last tag
gh release create v0.1.1 --title "v0.1.1" --generate-notes

# Or write notes yourself (opens your editor)
gh release create v0.1.1 --title "v0.1.1" --notes "Brief summary of what changed."

# Or pass a changelog file
gh release create v0.1.1 --title "v0.1.1" --notes-file CHANGELOG.md
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

#### Publish to npm

Skip this section until you want the package on [npmjs.com](https://www.npmjs.com/). GitHub releases alone are enough for `npx github:...` installs.

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

| Step                     | What happens                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm version patch`      | Sets `"version"` in `package.json` and `package-lock.json`, creates a git commit like `Release 0.1.1`, and tags it `v0.1.1`. Use `minor` or `major` instead of `patch` when appropriate. |
| `git push origin main`   | Pushes the version-bump commit to GitHub.                                                                                                                                                |
| `git push origin --tags` | Uploads the `v0.1.1` tag so GitHub knows which commit to release.                                                                                                                        |
| `gh release create`      | Creates the release on GitHub with notes; users can browse [Releases](https://github.com/lggarrison/llm-wiki-manager/releases) and install with `#v0.1.1`.                               |
| `npm publish`            | Uploads the package to npm so users can run `npx llm-wiki-manager` without the `github:` prefix.                                                                                         |

#### If something goes wrong

**Before pushing**

- Undo the version bump locally: `git tag -d v0.1.1` then `git reset --hard HEAD~1`.

**After pushing to GitHub**

- **Wrong tag, nobody has used it yet** — delete the remote tag (`git push origin --delete v0.1.1`), delete the GitHub Release (Releases page → release → Delete), fix locally, and re-run the release steps.
- **Forgot the GitHub Release** — the tag still exists; create the release later with `gh release create v0.1.1` or the website.
- **Tag pushed but forgot to publish to npm** — check out the tagged commit and run `npm publish`.

**npm-specific**

- **Published the wrong version** — npm does not allow re-publishing the same version number. Bump to a new patch (e.g. `0.1.2`), fix the issue, and publish again. Use `npm unpublish` only in rare cases within 72 hours and only if you are sure no one depends on that version ([npm unpublish policy](https://docs.npmjs.com/policies/unpublish)).

---

## License

MIT
