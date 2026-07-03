# GitHub Issue #66 — Modify Init to allow users to select formatting package of choice or none

- **URL:** https://github.com/lggarrison/llm-wiki-manager/issues/66
- **Author:** lggarrison
- **State:** open
- **Labels:** enhancement
- **Created:** 2026-07-03T00:11:46Z

---

## What problem are you trying to solve?

`init` scaffolds a wiki and wires npm scripts, but formatting is implicitly Prettier everywhere:

- `wiki:build` formats `index.md` via Prettier (`src/wiki/format-index.ts`)
- `setup-husky` / the lint-staged guide hardcodes `prettier --write` for `wiki/**/*.md` (`src/wiki/lint-staged-snippet.ts`)
- README hook docs assume Prettier is installed alongside Husky and lint-staged

Consumer projects may already use a different formatter (Biome, dprint, etc.), may not want a formatter at all, or may want to opt out of formatter-specific lint-staged tasks. Today they must manually edit generated snippets and README guidance after init.

## Proposed solution

Add a formatter choice to `init` (interactive prompt + non-interactive flag), persisted in `.llm-wiki-manager.json`:

| Option | Behavior |
| --- | --- |
| **Prettier** (default) | Current behavior — `wiki:build` uses Prettier; lint-staged snippet includes `prettier --write` |
| **Other supported formatter** | Emit the matching lint-staged command and adapt `formatIndexMarkdown` (or skip build-time formatting when no programmatic API exists) |
| **None** | Skip formatter devDependency hints, omit formatter step from lint-staged snippet, and leave `index.md` unformatted by build |

Suggested CLI surface:

```bash
llm-wiki-manager init --project-name my-app --formatter prettier   # default
llm-wiki-manager init --project-name my-app --formatter none
```

Interactive init should use a `@clack/prompts` select with the same options.

Downstream consumers of the choice:

- `src/wiki/lint-staged-snippet.ts` — generate formatter-specific task list
- `src/wiki/format-index.ts` — respect install config (or no-op when `none`)
- `src/wiki/setup-husky.ts` / init outro — tailor hook setup instructions
- `writeInstallConfig` / `InstallConfig` type — new `formatter` field
- Tests in `test/commands/init.test.ts`, `test/scripts/lint-staged-snippet.test.ts`, and e2e lint-staged idempotence coverage per formatter mode

## Alternatives considered

- **Document manual override in README only** — does not reduce setup friction; users still hunt for hardcoded Prettier references.
- **Always bundle Prettier as a runtime dependency** — already done for `wiki:build`, but does not address lint-staged / hook ergonomics or formatter preference.
- **Defer to `setup-husky` only** — hooks are optional and configured after init; formatter choice at init time still helps when users follow the recommended Husky + lint-staged path immediately.

## Additional context

Related code paths:

- `src/commands/init.ts` — prompts, install config, outro next-steps
- `src/wiki/format-index.ts` — build-time `index.md` formatting
- `src/wiki/lint-staged-snippet.ts` — pre-commit task list (`prettier --write` today)
- `README.md` § Optional git hooks — documents Prettier-centric setup

Acceptance criteria:

1. Init records the user's formatter choice in `.llm-wiki-manager.json`.
2. Lint-staged snippet and hook guidance match the selected formatter (or omit formatter tasks when `none`).
3. `wiki:build` does not assume Prettier when formatter is `none` (or a non-Prettier choice without a build adapter).
4. Non-interactive `--formatter` flag mirrors the interactive prompt for CI/tests.
5. Existing installs without a `formatter` field default to Prettier for backward compatibility.
