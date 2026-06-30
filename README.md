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

---

## License

MIT
