# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-01

### Added

- `init` command to scaffold an LLM-maintained wiki (wiki vault, management scripts, `AGENTS.md`, and `package.json` wiki scripts).
- `upgrade` command to refresh scaffold templates and migrate existing pages, tracked via a `.llm-wiki-manager.json` install manifest.
- `--help`/`-h` and `--version`/`-v` flags on the CLI.
- Wiki management scripts: lint, build-index, sync-see-also, log, help, migrate-pages, and setup-husky.
- GitHub Actions CI and a tag-triggered release workflow.
- Repository documentation and community health files (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue and PR templates, LICENSE).

[Unreleased]: https://github.com/lggarrison/llm-wiki-manager/commits/develop
[1.0.0]: https://github.com/lggarrison/llm-wiki-manager/releases/tag/v1.0.0
