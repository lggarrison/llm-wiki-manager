# LLM Wiki — Agent Entry

Read **`schema.md`** first for the full specification. This file is the quick orientation for agents maintaining this vault.

**Documentation scope** — {{FOCUS_DIRS}}

---

## Architecture

See [schema.md](schema.md) § Directory Layout. Key rules:

- **`entities/`** is flat — no subdirectories; scope = first tag in `tags:`
- **`concepts/`** — cross-cutting topics (shared mechanisms, architecture)
- **`raw/raw.md`** — hub for immutable ingested artifacts
- **`index.md`** — auto-generated; run `npm run wiki:build`

Run `npm run wiki:help` from the project root for wiki commands.

---

## §3 Page types

Every page declares its role with `type:` in frontmatter. `npm run wiki:lint` enforces type values and placement.

| Type | Placement | Purpose |
| --- | --- | --- |
| `overview` | `entities/<slug>.md` | One scope entry point per documented source area (see `.entity-scopes`) |
| `entity` | `entities/<slug>.md` | A concrete feature, module, or component |
| `comparison` | `entities/<slug>.md` | Same topic across two or more scopes |
| `deep-dive` | `entities/<slug>.md` | Long-form reference; co-locate by filename (e.g. `bubbles.md` + `bubbles-architecture-diagram.md`) |
| `concept` | `concepts/<slug>.md` | Genuinely cross-scope pattern or mechanism |
| `source` | `sources/<slug>.md` | LLM summary of one raw artifact |
| `hub` | `README.md`, `index.md`, or `raw/raw.md` only | Vault navigation/meta pages |

Quick placement guide:

- Scope entry points and entity-family pages → **`entities/`** (never nested)
- Cross-cutting synthesis → **`concepts/`**
- Ingest summaries → **`sources/`** (basename must match the paired raw file)
- Meta/navigation → **`hub`** at the paths above

---

## §3a Scope-tag convention

On every `entities/<slug>.md` page (`overview`, `entity`, `comparison`, `deep-dive`), the **first tag** is the scope slug. It maps to a documented source directory — see [schema.md](schema.md) § Flat `entities/` namespace.

Do not encode scope with folder nesting under `entities/`.

---

## §4 Frontmatter

### Required

| Field | Notes |
| --- | --- |
| `type` | One of the page types in §3 |
| `title` | Human-readable; used in `index.md` |
| `last_updated` | ISO date `YYYY-MM-DD`; update on every edit |

### Encouraged

| Field | Notes |
| --- | --- |
| `aliases` | Alternate titles for search |
| `tags` | Topic labels; first tag is the scope slug on entity-family pages |
| `related` | Wiki-root-relative paths to related pages |
| `sources` | (concept pages) paths to source summaries that back this page |
| `code_refs` | Repo-root-relative code paths (e.g. `src/commands/init.ts`); lint verifies each exists |
| `status` | `active` · `deprecated` · `wip` |
| `summary` | One sentence; shown in index tables |

Two field semantics worth internalizing:

- **`code_refs:`** — repo-root-relative paths. Lint verifies each exists on disk. This is the canonical place for code links — never wrap code paths in markdown links in the body.
- **`related:` ↔ body links** — every `related:` entry must also appear as a body markdown link (typically under `## See also`). Obsidian only renders graph edges from body links, not plain-string frontmatter. Lint warns on unmirrored entries; `npm run wiki:sync` auto-fixes.

---

## §5 Linking conventions

Lint enforces these rules:

- **Markdown links only** — no Obsidian `[[wikilinks]]` (breaks GitHub, IDE, and lint)
- **Relative paths** between wiki pages; code paths stay as inline backticks, not links
- **Body links target `.md` pages** — not directories or repo files (except `raw/raw.md` may link to `raw/` category folders)
- **No phantom-node links** — targets outside the vault or pointing at directories
- **No self-loop links** — a `sources/<id>.md` page must not body-link to its paired `raw/.../<id>.md`; put the raw path in frontmatter instead
- **Kebab-case filenames** — lowercase, hyphen-separated (e.g. `init-command.md`)

Source pairing: `sources/<slug>.md` shares the basename of its raw artifact (`raw/articles/<slug>.md`, etc.).

---

## Operations

### Ingest

1. Place artifact under `raw/<category>/` (articles, prs, tickets, design-notes, transcripts)
2. Create `sources/<slug>.md` summary (same basename as the raw file)
3. Update `entities/` and/or `concepts/` pages
4. `npm run wiki:sync` → `npm run wiki:build` → `npm run wiki:log -- add ingest "<title>"`

### Query

Read `index.md`, synthesize with citations, stub gaps as `status: wip`.

### Lint

`npm run wiki:lint` before committing wiki changes.

---

## Contradictions

Flag both pages with a `> ⚠️ Contradiction:` blockquote and create a reconciliation concept page.

## Gaps

Create stub pages (`status: wip`) rather than leaving broken `related:` references.
