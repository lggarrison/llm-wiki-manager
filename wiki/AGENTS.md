# LLM Wiki — Agent Entry

Read **`schema.md`** first for the full specification. This file is the quick orientation for agents maintaining this vault.

**Documentation scope** — `src/`, `templates/`

---

## Architecture

See [schema.md](schema.md) § Directory Layout. Key rules:

- **`entities/`** is flat — no subdirectories; scope = first tag in `tags:`
- **`concepts/`** — cross-cutting topics (shared mechanisms, architecture)
- **`raw/raw.md`** — hub for immutable ingested artifacts
- **`index.md`** — auto-generated; run `npm run wiki:build`

Run `npm run wiki:help` from the project root for wiki commands.

---

## §3a Scope-tag convention

On every `entities/<slug>.md` page, the **first tag** is the scope slug. It maps to a documented source directory — see [schema.md](schema.md) § Flat `entities/` namespace.

Do not encode scope with folder nesting under `entities/`.

---

## Operations

### Ingest

1. Place artifact under `raw/<category>/` (articles, prs, tickets, design-notes, transcripts)
2. Create `sources/<slug>.md` summary
3. Update `entities/` and/or `concepts/` pages
4. `npm run wiki:sync` → `npm run wiki:build` → `npm run wiki:log -- add ingest "<title>"`

### Query

Read `index.md`, synthesize with citations, stub gaps as `status: draft`.

### Lint

`npm run wiki:lint` before committing wiki changes.

---

## Page conventions (summary)

Every wiki page requires YAML frontmatter: `type`, `title`, `last_updated`, `tags`, `related`, `status`.

- Markdown links only — see `schema.md`
- Every `related:` path must appear as a body link (`npm run wiki:sync`)
- Update `last_updated` on every edit
- Run `npm run wiki:build` after adding or removing pages

## Contradictions

Flag both pages with a `> ⚠️ Contradiction:` blockquote and create a reconciliation concept page.

## Gaps

Create stub pages (`status: draft`) rather than leaving broken `related:` references.
