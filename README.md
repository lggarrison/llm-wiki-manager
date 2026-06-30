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
├── log.mjs            # Append operation entries to log.md
└── sync-see-also.mjs  # Sync related: frontmatter to body links

AGENTS.md              # Generic agent instructions (created or amended)
```

---

## Installation

### From npm (once published)

```bash
npx llm-wiki-manager init
```

### From a private GitHub repository

If the package is hosted in a private GitHub repo, install it directly using an HTTPS URL with a personal access token, or via SSH if your environment has GitHub access configured.

**Using npm with a GitHub URL:**

```bash
# HTTPS (replace TOKEN and owner/repo)
npm install --save-dev github:owner/llm-wiki-manager

# SSH (if your machine has a GitHub SSH key)
npm install --save-dev git+ssh://git@github.com:owner/llm-wiki-manager.git
```

Then run via:

```bash
npx llm-wiki-manager init
```

**Or run directly without installing:**

```bash
# HTTPS with token
npx github:owner/llm-wiki-manager init

# If npm is configured with a GitHub token (see below)
npx --yes github:owner/llm-wiki-manager init
```

**Configuring a GitHub personal access token for private repos:**

1. Create a token at GitHub → Settings → Developer settings → Personal access tokens
2. Grant it `repo` (read) scope
3. Add it to your `.npmrc`:

```
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
@owner:registry=https://npm.pkg.github.com
```

Or set it as an environment variable before running:

```bash
NPM_TOKEN=your_token npx github:owner/llm-wiki-manager init
```

---

## Initializing the wiki

From the root of your project, run:

```bash
npx llm-wiki-manager init
```

You will be prompted for:

| Prompt | Default | Description |
|---|---|---|
| Project name | — | Used in AGENTS.md headings and schema.md |
| Wiki directory | `wiki` | Where the wiki files are created |
| Scripts directory | `scripts/wiki` | Where the management scripts are placed |
| Focus directories | _(blank = whole project)_ | Directories the wiki documents, e.g. `src, api` |

After `init` completes:

1. Open `wiki/schema.md` to review the conventions your agent will follow
2. Share `AGENTS.md` with your LLM agent (or point it to the file)
3. Run `node scripts/wiki/lint.mjs` to confirm the scaffold is valid

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
node scripts/wiki/sync-see-also.mjs   # sync related: links to page bodies
node scripts/wiki/build-index.mjs     # regenerate index.md
node scripts/wiki/log.mjs add ingest "Title of source"
```

### Querying the wiki

Ask your agent a question. It will read `wiki/index.md` to locate relevant pages, then synthesize an answer with citations. If the query reveals a gap, the agent should create a stub page (`status: draft`) to track it.

```bash
node scripts/wiki/log.mjs add query "Summary of the question"
```

### Editing pages manually

- Update `last_updated` in the frontmatter whenever you change a page
- Run `node scripts/wiki/build-index.mjs` after adding or removing pages
- Run `node scripts/wiki/lint.mjs` to catch any broken links or missing fields

---

## Managing the wiki

### Lint — validate structure

```bash
node scripts/wiki/lint.mjs
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
node scripts/wiki/build-index.mjs
```

Walks all wiki pages, reads their frontmatter, and writes a fresh `index.md` grouped by page type (overview/hub → concepts → sources). Run this any time pages are added, removed, or renamed.

Options:
```bash
node scripts/wiki/build-index.mjs --wiki-dir path/to/wiki
```

### Log — record operations

```bash
node scripts/wiki/log.mjs add <op> "<title>"
```

Operations: `ingest`, `query`, `lint`, `maintenance`

Examples:
```bash
node scripts/wiki/log.mjs add ingest "RFC 9110 HTTP Semantics"
node scripts/wiki/log.mjs add query "How does auth token refresh work?"
node scripts/wiki/log.mjs add lint "weekly health check"
node scripts/wiki/log.mjs add maintenance "archived three stale pages"

# Backdate an entry
node scripts/wiki/log.mjs add ingest "Old doc" --date=2025-01-15
```

Options:
```bash
node scripts/wiki/log.mjs add <op> "<title>" --wiki-dir path/to/wiki
```

### Sync see-also — fix missing body links

```bash
node scripts/wiki/sync-see-also.mjs
```

For every `related:` entry in a page's frontmatter that lacks a corresponding markdown link in the body, appends the missing link under a `## See also` section. This keeps the wiki graph consistent.

Options:
```bash
node scripts/wiki/sync-see-also.mjs --dry            # preview changes without writing
node scripts/wiki/sync-see-also.mjs --wiki-dir path/to/wiki
```

---

## Wiki page conventions

Every wiki page must have YAML frontmatter:

```yaml
---
type: concept          # concept | source | overview | hub
title: "Page Title"
last_updated: 2025-06-30
tags: [auth, api]
related: []            # relative paths from wiki root
status: draft          # draft | stable | archived
---
```

- Place pages in the directory matching their type: `concepts/`, `sources/`, or wiki root (overview/hub)
- Use markdown links `[Title](path.md)` — never wikilinks `[[...]]`
- Every path in `related:` must also appear as a body link (run `sync-see-also.mjs` to auto-add)
- See `wiki/schema.md` for the full specification

---

## Requirements

- Node.js 18 or later
