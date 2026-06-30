Below is `SKILL.md` that could be read by an agent when updating PR descriptions or titles. Do not forget to update the PR title when you update the description. Make sure to remove this placeholder content when updating the PR.

````markdown
---
name: pull-request-updates
description: Write a clear, reviewer-friendly pull request description for this npm package monorepo. Use whenever the user asks to draft, rewrite, or improve a PR description, summarize a diff for review, or turn an issue into a writeup — including phrasings like "write a PR for...", "what should I put in the description?", or "help me describe this change". Apply this any time a PR-shaped writeup is needed, even if the user doesn't say "PR".
---

# Project context

This repo is a publishable npm monorepo (npm workspaces) of Node CLI tooling for Karpathy-style LLM wikis. It ships three packages under `packages/`: `@lggarrison/llm-wiki` (the linter/CLI), `@lggarrison/create-llm-wiki` (the `npm create` scaffolder), and `@lggarrison/cursor-rules` (a Cursor rule pack). Source is plain ESM `.mjs` with TypeScript types checked via `tsc --noEmit`. There is no app, no UI, and no deployment — this is library/CLI code consumed by other projects. Packages publish to GitHub Packages (`npm.pkg.github.com`) from the `Publish` workflow when a `v*` tag is pushed. CI runs lint + typecheck, a test matrix (`node --test` on Node 18/20/22/24 across Ubuntu and macOS), and lints the example vaults in `examples/`. There is no Jira; track work with GitHub issues.

# Writing a Good PR Title

Follow Conventional Commits: `type(scope): summary` where type is one of `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `chore`, `build`, `ci`, `test`. Prefer a package-oriented scope so reviewers can see what's affected at a glance: `feat(llm-wiki): ...`, `fix(create-llm-wiki): ...`, `chore(cursor-rules): ...`, `chore(deps): ...`, `ci(publish): ...`. If the change closes a GitHub issue, reference it in the description (not the title), e.g. `Closes #123`.

# Writing a Good PR Description

Explain _what_ changed, _why_, and _how to be confident it's safe to merge_ — in as few words as that takes.

## The template

```

## Summary

## Why

## Changes

## How to verify

## Checklist

## Notes

```

Skip sections that don't apply rather than padding them.

## What goes in each section

**Summary** — A few explicit sentences on the net change. Name the package(s) touched. The reviewer shouldn't have to read the diff to understand it. Reference the GitHub issue with `Closes #123` when applicable, but never _just_ link it.

**Why** — The motivation: the bug, the feature, the new CLI flag or lint rule, the dependency bump. The diff already shows _what_; this section justifies it.

**Changes** — Design decisions the diff alone won't reveal: new CLI commands/flags, changes to lint rules or their output, changes to the scaffolder templates in `create-llm-wiki/templates/`, public API or exported types in `types/`, the rule pack in `cursor-rules/rules/`, and any change to `bin/` entrypoints. Call out anything that affects the published surface of a package (new `exports`, `files`, `bin`, or `engines` constraints). Explain the _choices_, not what the code obviously does.

**How to verify** — How a reviewer gains confidence. Give exact commands: the relevant CLI invocation (e.g. `node packages/llm-wiki/bin/llm-wiki.mjs lint --app-root examples/minimal`), `npm test --workspace=packages/<pkg>`, or a `npm create` dry run for scaffolder changes. For behavior that's hard to eyeball (lint output, generated files, cross-Node-version differences), spell out the manual steps and expected output. Paste CLI output snippets where they make the change obvious.

**Checklist** — Markdown task list (`- [ ]`) of what must be true before merge. Include, as applicable:

- [ ] `npm run lint` passes (eslint + prettier)
- [ ] `npm run typecheck` passes (`tsc --noEmit`)
- [ ] `npm test --workspaces` passes
- [ ] Affected package(s) build: `npm run build --workspace=packages/<pkg>` (if present)
- [ ] Example vaults still lint clean (`examples/minimal`, `examples/monorepo`) if lint behavior changed
- [ ] Public surface changes (`bin` / `exports` / `files` / `engines`) are intentional and reflected in the package `README.md`
- [ ] Version bumps + `CHANGELOG.md` entry added if this should ship (and `npm run release:check` passes)
- [ ] No secrets or credentials committed

Also cover any other blocking items: pending approvals, required CI checks, dependent PRs, or `package-lock.json` updates. Drop items that genuinely don't apply rather than leaving them unchecked.

**Notes** — Follow-ups, tech debt, alternatives considered. Flag _"we should probably do X next"_ without blocking this PR on it. Note explicitly if this PR is _not_ meant to trigger a release (no version bump), so the reviewer doesn't expect a tag.

## Principles

- **Explicit over terse.** "See the issue" is not a description.
- **Prose, not fragments.** Complete sentences. The reader is a person.
- **Don't restate the diff.** The reviewer can read code. Tell them the _reasoning_.
- **Show the command, not just the claim.** For a CLI change, a pasted invocation and its output beats a paragraph describing it.
- **Mind the published surface.** This is library/CLI code others install — flag breaking changes to flags, output, exports, or supported Node versions loudly.
- **If the description sprawls, the PR should have been split.** Flag this rather than writing a 2000-word writeup for a 2000-line diff.

## Applying this

1. Gather inputs — diff, related GitHub issue, commit messages, the package(s) affected, relevant CLI output. Ask for what's missing only if it materially affects _what / why / how_.
2. Draft using the template. Skip sections that don't apply.
3. Keep it short. One good sentence beats three mediocre ones.
4. Update the PR title to match (Conventional Commits, package-scoped) when you update the description.
````
