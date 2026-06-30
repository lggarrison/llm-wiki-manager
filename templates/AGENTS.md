# LLM Wiki — {{PROJECT_NAME}}

This project uses a **persistent, compounding wiki** to accumulate and synthesize knowledge over time. The wiki is not a retrieval index — it is a living artifact that you (the agent) build and maintain incrementally.

**Documentation scope** — this wiki focuses on: {{FOCUS_DIRS}}

---

## Architecture

```
{{WIKI_DIR}}/raw/         ← immutable source documents (never edit)
{{WIKI_DIR}}/sources/     ← LLM-authored summaries of raw sources
{{WIKI_DIR}}/concepts/    ← LLM-authored synthesized knowledge pages
{{WIKI_DIR}}/index.md     ← auto-generated content catalog
{{WIKI_DIR}}/log.md       ← append-only operation log
{{WIKI_DIR}}/schema.md    ← full frontmatter spec and conventions
```

Read `{{WIKI_DIR}}/schema.md` before creating or editing any wiki page.

---

## Operations

### Ingest a new source
```
# After placing the raw document in {{WIKI_DIR}}/raw/:
node {{SCRIPTS_DIR}}/sync-see-also.mjs
node {{SCRIPTS_DIR}}/build-index.mjs
node {{SCRIPTS_DIR}}/log.mjs add ingest "<source title>"
```
Create a summary in `{{WIKI_DIR}}/sources/` and update or create concept pages that reference it.

### Query the wiki
Read `{{WIKI_DIR}}/index.md` to locate relevant pages, then synthesize an answer with citations. If the query reveals a gap, create a stub concept page (`status: draft`).
```
node {{SCRIPTS_DIR}}/log.mjs add query "<question summary>"
```

### Lint (health check)
Run before adding new content to catch broken links, missing frontmatter, and orphaned pages:
```
node {{SCRIPTS_DIR}}/lint.mjs
```

---

## Page Conventions (summary — full spec in schema.md)

Every page requires YAML frontmatter: `type`, `title`, `last_updated`, `tags`, `related`, `status`.

- Use **markdown links** `[Title](path.md)` — never wikilinks `[[...]]`
- Every `related:` path must also appear as a body link (run `sync-see-also.mjs` to sync)
- Update `last_updated` every time a page changes
- Run `build-index.mjs` after adding or removing pages

## Contradictions
Flag both pages with a `> ⚠️ Contradiction:` blockquote and create a reconciliation concept page.

## Gaps
Create stub pages (`status: draft`) rather than leaving broken `related:` references.
