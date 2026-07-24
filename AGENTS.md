<!-- llm-wiki-manager -->

# LLM Wiki — llm-wiki-manager

This project uses an LLM-maintained wiki. **Read [`wiki/AGENTS.md`](wiki/AGENTS.md) first** for agent instructions, operations, and conventions.

The full specification is in [`wiki/schema.md`](wiki/schema.md).

Run `npm run wiki:help` for wiki commands.

<!-- /llm-wiki-manager -->

## Cursor Cloud specific instructions

This repo is a **TypeScript CLI tool** (`llm-wiki-manager`) — there is no server or GUI. "Running the application" means executing the CLI, e.g. `node dist/bin/cli.js <command>` (build first) or the `wiki:*` npm scripts.

- **Node version:** the dev pin is Node 24 (`.nvmrc`); `nvm` default is set to 24, so login shells use it. The base `node` on `PATH` may be v22, which still satisfies `engines` (`>=20.12`) and works for every command — run `nvm use` to match the pin exactly.
- **Build before running `wiki:*`:** this repo's own `wiki:*` scripts call `node dist/bin/cli.js` directly (npm does not link a package's own `bin` into its own `node_modules/.bin`). After changing `src/`, run `npm run build` so the scripts and CLI reflect changes.
- **Full gate:** `npm run release:check` runs `check:node-types`, `lint`, `format:check`, `test`, `build`, `test:e2e`, `wiki:lint`, and `wiki:check`. Individual commands are documented in `README.md` and `package.json`.
- **Do not run `upgrade` against this repo** — it would rewrite the `wiki:*` scripts to the consumer (`llm-wiki-manager <command>`) form.
- Git hooks: `pre-commit` runs `lint-staged`, `pre-push` runs `release:check`.
