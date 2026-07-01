# Security Policy

## Supported versions

This project is pre-1.0 and under active development. Security fixes are applied to the latest released version and to the `develop` branch. Older versions are not maintained.

## Reporting a vulnerability

Please do **not** open a public issue for security-sensitive reports.

Instead, use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected version, and steps to reproduce.

If private reporting is unavailable to you, contact the maintainer through their GitHub profile at https://github.com/lggarrison.

## What to expect

- We aim to acknowledge a report within a few days.
- Once confirmed, we will work on a fix and coordinate a disclosure timeline with you.
- We will credit reporters in the release notes unless you prefer to remain anonymous.

## Scope

This is a command-line tool that scaffolds and edits files inside a user's project directory. Reports that are especially relevant include:

- Path traversal or writing files outside the intended target directory.
- Arbitrary code execution triggered by scaffolded scripts or templates.
- Any behavior that could exfiltrate or corrupt a consumer's project files.
