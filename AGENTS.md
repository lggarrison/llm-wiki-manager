<!-- llm-wiki-manager -->

# LLM Wiki — llm-wiki-manager

This project uses a **persistent, compounding wiki** to accumulate and synthesize knowledge over time. The wiki is not a retrieval index — it is a living artifact that you (the agent) build and maintain incrementally.

**Documentation scope** — this wiki focuses on: `src/`, `templates/`

---

## Architecture

```
wiki/
├── AGENTS.md       ← agent entry (see also wiki/AGENTS.md in vault)
├── README.md       ← human / Obsidian entry
├── raw/raw.md      ← hub for immutable ingested artifacts
├── entities/       ← flat scope overviews (one .md per source area)
├── concepts/       ← cross-cutting synthesized knowledge
├── sources/        ← summaries of raw sources
├── index.md        ← auto-generated content catalog
├── log.md          ← append-only operation log
└── schema.md       ← full frontmatter spec and conventions
```

Read `wiki/schema.md` before creating or editing any wiki page.

Run `npm run wiki:help` for a list of wiki commands and when to use them.

---

## Operations

### Ingest a new source

```
# After placing the raw document in wiki/raw/:
npm run wiki:sync
npm run wiki:build
npm run wiki:log -- add ingest "<source title>"
```

Create a summary in `wiki/sources/` and update or create concept pages that reference it.

### Query the wiki

Read `wiki/index.md` to locate relevant pages, then synthesize an answer with citations. If the query reveals a gap, create a stub concept page (`status: draft`).

```
npm run wiki:log -- add query "<question summary>"
```

### Lint (health check)

Run before adding new content to catch broken links, missing frontmatter, and orphaned pages:

```
npm run wiki:lint
```

If npm scripts are unavailable, use `node scripts/wiki/lint.mjs`.

---

## Page Conventions (summary — full spec in schema.md)

Every page requires YAML frontmatter: `type`, `title`, `last_updated`, `tags`, `related`, `status`.

- Use **markdown links** — see `wiki/schema.md` for the link format — never wikilinks `[[...]]`
- Every `related:` path must also appear as a body link (run `npm run wiki:sync` to sync)
- Update `last_updated` every time a page changes
- Run `npm run wiki:build` after adding or removing pages

## Contradictions

Flag both pages with a `> ⚠️ Contradiction:` blockquote and create a reconciliation concept page.

## Gaps

Create stub pages (`status: draft`) rather than leaving broken `related:` references.
