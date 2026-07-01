# Releasing llm-wiki-manager

Day-to-day work happens on the **`develop`** branch; releases are cut from **`main`**. Releases are **automated** by a GitHub Actions workflow (`.github/workflows/release.yml`): when you push a `vX.Y.Z` tag whose commit is on `main`, the workflow runs the `release:check` gates and publishes a **GitHub Release** with auto-generated notes. You no longer run `gh release create` by hand.

Today a release means a GitHub Release only (git tag + notes on GitHub). Publishing to the **npm registry** is a separate, manual step you can add later — see [Publishing to npm](#publishing-to-npm-optional).

## Branching model

- **`develop`** — integration branch. Feature branches merge here.
- **`main`** — release branch. Merge `develop` into `main` (via PR) when you are ready to ship, then tag.

Users install from GitHub today with:

```bash
npx github:lggarrison/llm-wiki-manager init
```

After you tag a release, they can pin a version:

```bash
npx github:lggarrison/llm-wiki-manager#v0.1.1 init
```

## One-time setup

### GitHub

The release workflow authenticates with the repository's built-in `GITHUB_TOKEN`, so no setup is required for the normal (tag-triggered) flow. The [GitHub CLI](https://cli.github.com/) (`gh`) is only needed for the manual fallback below:

```bash
gh auth login
```

### npm (skip until you are ready to publish to the registry)

1. Create an [npm account](https://www.npmjs.com/signup) if you do not have one.
2. Log in from your machine:

   ```bash
   npm login
   ```

3. Confirm you are logged in as the account that should own the package:

   ```bash
   npm whoami
   ```

## Version numbers (semver)

Use [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Bump  | When to use it                                      | Example           |
| ----- | --------------------------------------------------- | ----------------- |
| patch | Bug fixes, docs, internal changes — no new behavior | `0.1.0` → `0.1.1` |
| minor | New features that stay backward compatible          | `0.1.0` → `0.2.0` |
| major | Breaking changes (CLI flags, output, file layout)   | `0.1.0` → `1.0.0` |

While the package is `0.x.y`, treat **minor** bumps as the place for breaking changes if you prefer not to jump to `1.0.0` yet.

Tags use a `v` prefix to match npm convention: `v0.1.1` for version `0.1.1`.

## Pre-release checklist

Run this on a clean `main` branch with all changes merged:

```bash
git checkout main
git pull
npm run release:check
```

`release:check` runs lint, format check, tests, and a production build. The release workflow runs this same command on the tagged commit, so running it locally first just gives you a faster signal — if it fails locally, the release run would fail too.

Add a [CHANGELOG.md](CHANGELOG.md) entry describing what changed since the last release. You can paste that text into the GitHub Release notes.

## Cutting a release (normal path)

Replace `patch` with `minor` or `major` as needed. On Windows PowerShell, run each command on its own line.

```bash
# 1. Get main up to date with the changes you want to ship
git checkout main
git pull
git merge --ff-only develop        # or merge develop -> main via a PR on GitHub

# 2. (optional) Verify locally — the workflow runs this too
npm run release:check

# 3. Bump version: updates package.json + package-lock.json, commits "Release x.y.z", tags vX.Y.Z
npm version patch -m "Release %s"

# 4. Push the commit AND the tag — pushing the tag triggers the Release workflow
git push --follow-tags
```

That's it. Open the **Actions** tab to watch the run; when it succeeds, the release appears on the [Releases page](https://github.com/lggarrison/llm-wiki-manager/releases) with auto-generated notes.

## What the release workflow does

Triggered by a pushed tag matching `v*.*.*`, the workflow:

1. **Guards the release** — fails unless the tagged commit is on `main`, and unless the tag equals `v` + the `version` in `package.json` (so a forgotten `npm version` can't ship the wrong version).
2. **Runs `npm run release:check`** — lint, format check, tests, and a production build.
3. **Creates the GitHub Release** — `gh release create "$TAG" --generate-notes`, using the built-in `GITHUB_TOKEN`.

## Manual release (fallback)

If you ever need to create a release without the workflow (for example, the tag already exists but no release was published), use the GitHub CLI or the website.

### Option A — GitHub CLI

```bash
gh release create v0.1.1 --title "v0.1.1" --generate-notes
```

Use the same version in the tag name as in `package.json` (with a `v` prefix).

### Option B — GitHub website

1. Open [github.com/lggarrison/llm-wiki-manager/releases](https://github.com/lggarrison/llm-wiki-manager/releases).
2. Click **Draft a new release**.
3. Click **Choose a tag**, type `v0.1.1` (match `package.json`), and select **Create new tag on publish** if the tag is not listed yet. Target branch: `main`.
4. Set the release title to `v0.1.1`.
5. Click **Generate release notes** or write a short summary of changes.
6. Click **Publish release**.

### Verify the GitHub release

```bash
# List releases
gh release list

# Install the tagged version (smoke test)
npx github:lggarrison/llm-wiki-manager#v0.1.1 --help
```

## Publishing to npm (optional)

The release workflow does **not** publish to npm — it only creates the GitHub Release. Skip this section until you want the package on [npmjs.com](https://www.npmjs.com/); GitHub releases alone are enough for `npx github:...` installs. When you are ready, publish manually from the tagged commit:

```bash
npm publish
```

`prepublishOnly` rebuilds `dist/` before upload. Only `dist/` and `templates/` are published (see `"files"` in `package.json`).

**Dry run** — see what would be uploaded without publishing:

```bash
npm pack --dry-run
```

You can also generate the tarball locally:

```bash
npm pack
# produces llm-wiki-manager-0.1.0.tgz — delete it when done inspecting
```

## What each step does

| Step                       | What happens                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm version patch`        | Sets `"version"` in `package.json` and `package-lock.json`, creates a git commit like `Release 0.1.1`, and tags it `v0.1.1`. Use `minor` or `major` instead of `patch` when appropriate.                                                                    |
| `git push --follow-tags`   | Pushes the version-bump commit and the `v0.1.1` tag together. Pushing the tag triggers the Release workflow.                                                                                                                                                |
| Release workflow           | Verifies the tag is on `main` and matches `package.json`, runs `release:check`, then creates the GitHub Release with auto-generated notes. Users can browse [Releases](https://github.com/lggarrison/llm-wiki-manager/releases) and install with `#v0.1.1`. |
| `npm publish` _(optional)_ | Uploads the package to npm so users can run `npx llm-wiki-manager` without the `github:` prefix. Not run by the workflow.                                                                                                                                   |

## If something goes wrong

### Before pushing

- Undo the version bump locally: `git tag -d v0.1.1` then `git reset --hard HEAD~1`.

### After pushing to GitHub

- **Workflow failed (release:check or a guard)** — fix the issue on `main`, then either re-run the failed run from the **Actions** tab, or delete and re-push the tag: `git push origin --delete v0.1.1`, fix, re-tag, and `git push --follow-tags`.
- **Wrong tag, nobody has used it yet** — delete the remote tag (`git push origin --delete v0.1.1`), delete the GitHub Release if one was created (Releases page → release → Delete), fix locally, and re-run the release steps.
- **Tag exists but no GitHub Release** — re-run the workflow from the Actions tab, or create it manually with `gh release create v0.1.1 --generate-notes`.
- **Want it on npm too** — check out the tagged commit and run `npm publish` (see [Publishing to npm](#publishing-to-npm-optional)).

### npm-specific

- **Published the wrong version** — npm does not allow re-publishing the same version number. Bump to a new patch (e.g. `0.1.2`), fix the issue, and publish again. Use `npm unpublish` only in rare cases within 72 hours and only if you are sure no one depends on that version ([npm unpublish policy](https://docs.npmjs.com/policies/unpublish)).
