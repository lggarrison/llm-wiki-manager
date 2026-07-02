# Releasing llm-wiki-manager

Day-to-day work happens on the **`develop`** branch; releases are cut from **`main`**. Releases are **automated** by a GitHub Actions workflow (`.github/workflows/release.yml`): when you push a `vX.Y.Z` tag whose commit is on `main`, the workflow runs the `release:check` gates, publishes the package to the **npm registry**, and creates a **GitHub Release** with auto-generated notes. You no longer run `gh release create` or `npm publish` by hand for normal releases.

## Quick reference

**v1.0.0 shipped** (July 2026). One-time npm setup is done; Trusted Publishing is configured. The repository is **public**.

|        | Link                                                               |
| ------ | ------------------------------------------------------------------ |
| npm    | https://www.npmjs.com/package/llm-wiki-manager                     |
| GitHub | https://github.com/lggarrison/llm-wiki-manager/releases/tag/v1.0.0 |

### Next release (v1.0.1+)

On `develop`, bump the version and push. Open a PR into `main` (CI must pass; use a **merge commit**, not squash). After the PR merges, push the tag:

```bash
git checkout develop && git pull
npm version patch -m "Release %s"
git push origin develop
# open PR develop → main, merge with "Create a merge commit"
git checkout main && git pull
git push origin v1.0.1   # replace with the version you just bumped to
```

CI handles npm publish and the GitHub Release when the tag lands. Use `minor` or `major` instead of `patch` when appropriate. See [Cutting a release](#cutting-a-release-normal-path) for the full walkthrough.

## Branching model

- **`develop`** — integration branch. Feature branches merge here.
- **`main`** — release branch. Merge `develop` into `main` (via PR) when you are ready to ship, then push the release tag.

### Branch protection

Both branches have active GitHub **rulesets** (Settings → Rules → Rulesets):

| Branch        | Rules                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **`develop`** | Branch deletion and force-push blocked; direct pushes and PR merges still allowed                                                    |
| **`main`**    | Branch deletion and force-push blocked; **PR required**; all four CI matrix jobs must pass (`verify` on Ubuntu/Windows × Node 20/24) |

Direct pushes to `develop` are still allowed — only deletion and force-push are restricted there. Direct pushes to `main` are blocked — release changes reach `main` only through a PR. **Tag pushes are not blocked**, so you push the `vX.Y.Z` tag after the release PR merges. Use a **merge commit** when merging the release PR so the tagged commit remains on `main` (squash or rebase merges change the commit SHA and the release workflow will reject the tag).

Users install from npm:

```bash
npx llm-wiki-manager init
```

After you tag a release, they can pin a version:

```bash
npx llm-wiki-manager@1.0.1 init
# or from GitHub:
npx github:lggarrison/llm-wiki-manager#v1.0.1 init
```

## One-time setup

> **Done for v1.0.0** — you only need this section again if you fork the project or create a new npm package.

Complete this before cutting **v1.0.0** (or any release that should appear on npm).

### GitHub

The repository must be **public** for release pages and `npx github:…` installs to work for everyone.

The release workflow authenticates with the repository's built-in `GITHUB_TOKEN`, so no setup is required for the normal (tag-triggered) flow. The [GitHub CLI](https://cli.github.com/) (`gh`) is only needed for the manual fallback below:

```bash
gh auth login
```

### npm

1. Create an [npm account](https://www.npmjs.com/signup) if you do not have one.
2. Log in from your machine (useful for dry runs and troubleshooting):

   ```bash
   npm login
   ```

3. Confirm you are logged in as the account that should own the package:

   ```bash
   npm whoami
   ```

4. **Remove the publish guard** — `package.json` has `"private": true` to block accidental publishes during development. Remove that field (or set it to `false`) on `main` and commit before the first npm release:

   ```bash
   # verify npm publish would succeed (after removing "private")
   npm pack --dry-run
   ```

5. **Publish the first version manually** — npm requires the package to exist on the registry before you can configure [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/). From a clean `main` checkout at the version you want to ship (e.g. `1.0.0`):

   ```bash
   npm run release:check
   npm publish --access public
   ```

   Use `npm login` first if you are not already authenticated. This one-time manual publish is only needed to create the package on npm; subsequent releases are handled by CI.

6. **Configure Trusted Publishing on npm** — open [package access settings](https://www.npmjs.com/package/llm-wiki-manager/access) → **Trusted Publisher** → **GitHub Actions**, then set:

   | Field                | Value              |
   | -------------------- | ------------------ |
   | Organization or user | `lggarrison`       |
   | Repository           | `llm-wiki-manager` |
   | Workflow filename    | `release.yml`      |

   Click **Set up connection** and confirm with 2FA. The workflow filename must match exactly (including `.yml`). No `NPM_TOKEN` or other npm secret is stored in GitHub — the workflow authenticates with short-lived OIDC credentials.

   The release workflow (`.github/workflows/release.yml`) already publishes via Trusted Publishing: it grants `id-token: write`, points `setup-node` at the npm registry, and runs `npm publish` without `NODE_AUTH_TOKEN`. Provenance attestations are generated automatically.

   **Requirements:** npm CLI **11.5.1+** (bundled with Node **24**, matching `.nvmrc`) and GitHub-hosted runners (`ubuntu-latest`).

7. **(Optional, recommended)** After Trusted Publishing works, tighten npm security under **Settings → Publishing access** → **Require two-factor authentication and disallow tokens**. Trusted Publishing continues to work; long-lived publish tokens are blocked.

## Version numbers (semver)

Use [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Bump  | When to use it                                      | Example           |
| ----- | --------------------------------------------------- | ----------------- |
| patch | Bug fixes, docs, internal changes — no new behavior | `1.0.0` → `1.0.1` |
| minor | New features that stay backward compatible          | `1.0.0` → `1.1.0` |
| major | Breaking changes (CLI flags, output, file layout)   | `1.0.0` → `2.0.0` |

Tags use a `v` prefix to match npm convention: `v1.0.1` for version `1.0.1`.

## Pre-release checklist

Run this on a clean `develop` branch before opening the release PR:

```bash
git checkout develop
git pull
npm run release:check
```

`release:check` runs lint, format check, tests, and a production build. The release workflow runs this same command on the tagged commit, so running it locally first just gives you a faster signal — if it fails locally, the release run would fail too.

Add a [CHANGELOG.md](CHANGELOG.md) entry describing what changed since the last release. You can paste that text into the GitHub Release notes.

Before the **first** npm release, confirm `"private"` is removed from `package.json`, the package has been published once manually, and Trusted Publishing is configured on npm for `release.yml`.

## Cutting a release (normal path)

Replace `patch` with `minor` or `major` as needed. On Windows PowerShell, run each command on its own line.

Because `main` requires a PR, bump the version on `develop`, merge via PR, then push the tag separately (do not use `--follow-tags` until after the PR merges — pushing the tag early triggers the release workflow before the commit is on `main`).

```bash
# 1. Bump version on develop (creates "Release x.y.z" commit + local vX.Y.Z tag)
git checkout develop
git pull
npm run release:check              # optional — the workflow runs this too
npm version patch -m "Release %s"

# 2. Push the version commit to develop (not the tag yet)
git push origin develop

# 3. Open a PR: develop → main. Wait for CI. Merge with "Create a merge commit".
#    Squash/rebase merges change the commit SHA and will break the release tag.

# 4. After the PR merges, push the tag — this triggers the Release workflow
git checkout main
git pull
git push origin v1.0.1             # use the version you just bumped to
```

> **First release (v1.0.0):** Complete [one-time npm setup](#npm) steps 1–6 first (including the manual `npm publish` and Trusted Publisher configuration). Because `1.0.0` is already on npm after the manual publish, create the GitHub Release by hand instead of pushing a tag (pushing `v1.0.0` would trigger the workflow and fail at `npm publish` with a duplicate version):
>
> ```bash
> git checkout main
> git pull
> gh release create v1.0.0 --title "v1.0.0" --generate-notes
> ```
>
> Automated npm + GitHub Release via the workflow begins with **v1.0.1** (version bump on `develop`, PR into `main`, then `git push origin v1.0.1`).

That's it. Open the **Actions** tab to watch the run; when it succeeds, the release appears on the [Releases page](https://github.com/lggarrison/llm-wiki-manager/releases) and on [npm](https://www.npmjs.com/package/llm-wiki-manager).

## What the release workflow does

Triggered by a pushed tag matching `v*.*.*`, the workflow:

1. **Guards the release** — fails unless the tagged commit is on `main`, and unless the tag equals `v` + the `version` in `package.json` (so a forgotten `npm version` can't ship the wrong version).
2. **Runs `npm run release:check`** — lint, format check, tests, and a production build.
3. **Publishes to npm** — `npm publish` uploads `dist/` and `templates/` to the registry via [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC; no stored token). `prepublishOnly` rebuilds `dist/` first; provenance is attached automatically.
4. **Creates the GitHub Release** — `gh release create "$TAG" --generate-notes`, using the built-in `GITHUB_TOKEN`.

## Manual release (fallback)

If you ever need to create a release without the workflow (for example, the tag already exists but no release was published), use the GitHub CLI or the website.

### Option A — GitHub CLI

```bash
gh release create v1.0.1 --title "v1.0.1" --generate-notes
```

Use the same version in the tag name as in `package.json` (with a `v` prefix).

If npm publish also failed or was skipped, check out the tagged commit and publish manually:

```bash
git checkout v1.0.1
npm publish --access public
```

### Option B — GitHub website

1. Open [github.com/lggarrison/llm-wiki-manager/releases](https://github.com/lggarrison/llm-wiki-manager/releases).
2. Click **Draft a new release**.
3. Click **Choose a tag**, type `v1.0.1` (match `package.json`), and select **Create new tag on publish** if the tag is not listed yet. Target branch: `main`.
4. Set the release title to `v1.0.1`.
5. Click **Generate release notes** or write a short summary of changes.
6. Click **Publish release**.

### Verify the release

```bash
# List GitHub releases
gh release list

# Smoke test from npm
npx llm-wiki-manager@1.0.1 --help

# Smoke test from GitHub tag
npx github:lggarrison/llm-wiki-manager#v1.0.1 --help
```

## npm publish details

Only `dist/` and `templates/` are published (see `"files"` in `package.json`). The package is public (`--access public`).

**Dry run** — see what would be uploaded without publishing:

```bash
npm pack --dry-run
```

You can also generate the tarball locally:

```bash
npm pack
# produces llm-wiki-manager-1.0.0.tgz — delete it when done inspecting
```

## What each step does

| Step                       | What happens                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm version patch`        | On `develop`: sets `"version"` in `package.json` and `package-lock.json`, creates a git commit like `Release 1.0.1`, and tags it `v1.0.1` locally. Use `minor` or `major` instead of `patch` when appropriate.                                                                                 |
| `git push origin develop`  | Pushes the version-bump commit to `develop`. Open a PR into `main` before pushing the tag.                                                                                                                                                                                                     |
| `git push origin v1.0.1`   | After the release PR merges, pushes the tag. Pushing the tag triggers the Release workflow. Direct pushes to `main` are blocked by branch protection; the version commit reaches `main` through the PR.                                                                                        |
| Release workflow           | Verifies the tag is on `main` and matches `package.json`, runs `release:check`, publishes to npm, then creates the GitHub Release with auto-generated notes. Users can install via `npx llm-wiki-manager@1.0.1` or browse [Releases](https://github.com/lggarrison/llm-wiki-manager/releases). |
| `npm publish` _(fallback)_ | Manual publish from a tagged checkout when the workflow did not run or npm publish failed. Not needed for normal releases.                                                                                                                                                                     |

## If something goes wrong

### Before pushing

- Undo the version bump locally: `git tag -d v1.0.1` then `git reset --hard HEAD~1`.

### After pushing to GitHub

- **Workflow failed (release:check or a guard)** — fix the issue on `develop`, merge to `main` via PR, then either re-run the failed run from the **Actions** tab, or delete and re-push the tag: `git push origin --delete v1.0.1`, fix, re-tag, and `git push origin v1.0.1`.
- **Wrong tag, nobody has used it yet** — delete the remote tag (`git push origin --delete v1.0.1`), delete the GitHub Release if one was created (Releases page → release → Delete), fix locally, and re-run the release steps.
- **Tag exists but no GitHub Release** — re-run the workflow from the Actions tab, or create it manually with `gh release create v1.0.1 --generate-notes`.
- **GitHub Release succeeded but npm publish failed** — common Trusted Publishing causes: Trusted Publisher not configured, workflow filename mismatch (`release.yml`), missing `id-token: write`, or npm CLI too old (need 11.5.1+ / Node 24). Fix the npm settings, re-run the workflow, or check out the tag and run `npm publish --access public` manually with `npm login`.
- **npm succeeded but GitHub Release failed** — create the GitHub Release manually (see [Manual release](#manual-release-fallback)); the npm version is already live.

### npm-specific

- **Published the wrong version** — npm does not allow re-publishing the same version number. Bump to a new patch (e.g. `1.0.2`), fix the issue, and publish again. Use `npm unpublish` only in rare cases within 72 hours and only if you are sure no one depends on that version ([npm unpublish policy](https://docs.npmjs.com/policies/unpublish)).
- **`npm publish` refused — package is marked private** — remove `"private": true` from `package.json`, commit to `main`, and re-tag or publish from a commit that includes the change.
