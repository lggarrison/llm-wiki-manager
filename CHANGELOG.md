# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The recommended lint-staged wiki hook now explicitly stages regenerated `wiki/index.md` after `wiki:build`, preventing commits that include a new wiki page but omit the updated index.

## [1.0.3] - 2026-07-02

### Fixed

- `wiki:build` now formats `index.md` with Prettier (using the consumer repo's config) so output is idempotent under the documented lint-staged pre-commit pipeline.
- Interactive `init` pre-fills `src` as the default focus directory so Enter accepts it without typing.
- `init` and `upgrade` now warn to run `npm install` when `node_modules` has a stale `llm-wiki-manager` version, not only when the local binary is missing.
- `init` and `upgrade` update an existing `devDependencies` entry when the running CLI version is newer.
- `doctor` suggests `npm install` when the scaffold version in `.llm-wiki-manager.json` does not match the installed package in `node_modules`.

### Changed

- `prettier` is a runtime dependency so `wiki:build` can format `index.md` when the consumer has no local Prettier install (consumer Prettier is still preferred when present).

## [1.0.2] - 2026-07-02

### Added

- `wiki:doctor` npm script in scaffolded `package.json` for post-init health checks.

### Fixed

- Post-init guidance and `doctor` hints now point users to `wiki:*` npm scripts instead of raw CLI paths.
- `upgrade` no longer corrupts wiki-managed content during template migration.
- E2E tests run serially to avoid a `dist/` race during `npm pack`.

### Changed

- Release workflow now syncs `main` back into `develop` after each tagged release.

## [1.0.1] - 2026-07-02

### Fixed

- Post-init and upgrade flows prompt for `npm install` when the local binary is missing.

## [1.0.0] - 2026-07-01

### Added

- `init` command to scaffold an LLM-maintained wiki (wiki vault, `AGENTS.md`, and `package.json` wiki scripts). `init` now generates `index.md` from the scaffolded pages so `wiki:check` passes immediately.
- `upgrade` command to refresh scaffold templates and migrate existing pages, tracked via a `.llm-wiki-manager.json` install manifest.
- `doctor` command — read-only scaffold health check: install config, scaffold-vs-package version, wiki meta files, `AGENTS.md` managed section, npm-script sync, and `index.md` freshness.
- Wiki management subcommands built into the CLI (`help`, `lint`, `build`, `check`, `sync`, `log`, `setup-husky`) — no scripts are copied into consumer projects, so fixes ship with package updates.
- `--help`/`-h` and `--version`/`-v` flags; `DEBUG=1` prints full stack traces on errors.
- Lint rejects block-style YAML lists in frontmatter with guidance to use inline arrays; the frontmatter parser handles Prettier-wrapped inline arrays.
- GitHub Actions CI matrix (Ubuntu + Windows × Node 20 + 24), a tag-triggered release workflow, and a packed-tarball smoke test in the e2e suite.
- Repository documentation and community health files (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, RELEASING, issue and PR templates, LICENSE).

### Fixed

- `wiki:check` tolerates CRLF line endings, so git `autocrlf` checkouts no longer report a permanently stale index.
- `sync` no longer skips pages whose paths merely contain the substring `raw`, and inserts links inside an existing `## See also` section instead of at end of file.
- The managed `AGENTS.md` section is bounded by an explicit end marker, so `upgrade` preserves user content added after it.
- `package.json` files with a UTF-8 BOM (as written by PowerShell and some editors) are parsed instead of crashing.

[Unreleased]: https://github.com/lggarrison/llm-wiki-manager/compare/v1.0.3...develop
[1.0.3]: https://github.com/lggarrison/llm-wiki-manager/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/lggarrison/llm-wiki-manager/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/lggarrison/llm-wiki-manager/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/lggarrison/llm-wiki-manager/releases/tag/v1.0.0
