# Wiki Schema — {{PROJECT_NAME}}

This document defines the conventions your LLM agent must follow when creating and maintaining wiki pages.

---

## Frontmatter

Every wiki page **must** begin with YAML frontmatter:

```yaml
---
type: concept | source | overview | hub
title: "Human-readable title"
last_updated: YYYY-MM-DD
tags: []
related: []
status: draft | stable | archived
---
```

### Field definitions

| Field | Required | Values / Notes |
|---|---|---|
| `type` | yes | `concept` — synthesized knowledge; `source` — summary of a raw source; `overview` — entry point for a topic area; `hub` — links-only navigation page |
| `title` | yes | Human-readable, used in index and log |
| `last_updated` | yes | ISO date `YYYY-MM-DD`; update every time the page changes |
| `tags` | yes | List of topic labels; used to group pages in index.md |
| `related` | yes | List of relative paths to related pages (may be empty `[]`) |
| `status` | yes | `draft` → actively being built; `stable` → reliable reference; `archived` → superseded |
| `summary` | no | One-sentence description; shown in index tables |
| `sources` | no | (concept pages) paths to source summaries that back this concept |

---

## Documentation Scope

This wiki documents the following directories:

{{FOCUS_DIRS_LIST}}

When ingesting new source material or creating concept pages, prefer content that originates from or is relevant to these directories. Pages about code outside this scope are allowed but should be clearly tagged.

---

## Directory Layout

```
{{WIKI_DIR}}/
├── schema.md       ← this file
├── index.md        ← auto-generated; run build-index.mjs
├── log.md          ← append-only operation log
├── concepts/       ← synthesized knowledge pages
├── sources/        ← summaries of raw source documents
└── raw/            ← immutable ingested source documents (never edit)
```

Place new pages in the directory that matches their `type`:
- `concept` → `{{WIKI_DIR}}/concepts/<slug>.md`
- `source` → `{{WIKI_DIR}}/sources/<slug>.md`
- `overview` / `hub` → `{{WIKI_DIR}}/<slug>.md` (top-level)

---

## Link Conventions

- Use **markdown links** only: `[Page Title](relative/path.md)`
- Never use wikilinks (`[[...]]`)
- Every path listed in `related:` frontmatter must also appear as a markdown link in the page body, typically under a `## See also` section
- Cross-references must use paths relative to the wiki root, e.g. `concepts/caching.md`

---

## Three Core Operations

### Ingest
Process a new source document:
1. Place the raw document in `{{WIKI_DIR}}/raw/`
2. Read it and discuss key takeaways
3. Create a summary page in `{{WIKI_DIR}}/sources/<slug>.md`
4. Create or update concept pages in `{{WIKI_DIR}}/concepts/` that reference this source
5. Update `related:` and body links on affected pages
6. Run `npm run wiki:sync` to sync missing body links
7. Run `npm run wiki:build` to update `index.md`
8. Run `npm run wiki:log -- add ingest "<title of source>"`

### Query
Answer a question using the wiki:
1. Read `index.md` to locate relevant pages
2. Synthesize an answer with citations to wiki pages
3. If the answer reveals a gap, create a stub page with `status: draft`
4. Log: `npm run wiki:log -- add query "<question summary>"`

### Lint
Periodic health check:
1. Run `npm run wiki:lint` (or `node {{SCRIPTS_DIR}}/lint.mjs` if npm scripts are unavailable)
2. Resolve any errors before adding new content
3. Log: `npm run wiki:log -- add lint "health check"`

---

## Contradiction Handling

When two pages assert conflicting facts:
1. Add a `> ⚠️ Contradiction: see [other page](path)` blockquote to both pages
2. Create a concept page that reconciles the conflict with evidence
3. Update both original pages to reference the reconciliation page
4. Change conflicting pages to `status: draft` until resolved

## Gap Flagging

When a `related:` reference would point to a page that doesn't exist yet, create a stub:

```yaml
---
type: concept
title: "Placeholder Title"
last_updated: YYYY-MM-DD
tags: []
related: []
status: draft
summary: "Stub — needs research."
---

> 📌 This page is a stub. Add content when source material is available.
```
