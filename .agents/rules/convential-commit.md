---
trigger: always_on
---

# Conventional Commit Messages

When creating Git commits, always follow the **Conventional Commits 1.0.0** specification.

## Format

```text
<type>(optional-scope): <description>
```

Example:

```text
feat(auth): add Google OAuth login
fix(parser): prevent duplicate SMS imports
docs(readme): update installation instructions
```

## Commit Types

Choose the type that best represents the **primary purpose** of the change.

| Type | Use for |
|------|---------|
| `feat` | Introducing a new feature or functionality |
| `fix` | Fixing a bug or incorrect behavior |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `docs` | Documentation-only changes |
| `style` | Formatting, whitespace, or style changes with no logic changes |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance tasks that don't affect application behavior |
| `revert` | Reverting a previous commit |

## Scope

- Include a scope when it clearly identifies the affected module or feature.
- Examples: `auth`, `api`, `ui`, `parser`, `db`, `sms`.
- Omit the scope if it doesn't add value.

## Description

The description should:

- Use the **imperative mood** (e.g., "add", "fix", "update", "remove").
- Start with a lowercase letter.
- Be concise (preferably under 72 characters).
- Describe **what changed**, not why.
- Never end with a period.

Good:

```text
feat(expenses): add recurring transaction support
fix(api): handle null user responses
refactor(parser): simplify transaction extraction
```

Bad:

```text
Added recurring transactions
Fixed bug
misc changes
updated stuff
```

## Breaking Changes

For breaking changes, append `!` after the type or scope and include a footer.

```text
feat(api)!: redesign authentication flow

BREAKING CHANGE: Existing API tokens are no longer supported.
```

## General Rules

- Inspect the Git diff before generating the commit message.
- Base the message on the **actual code changes**, not the original task description.
- do not amend commit unless specificall said by user
- If a commit contains unrelated changes, split it into multiple commits whenever possible.
- Avoid vague messages such as `update`, `changes`, `misc`, `wip`, or `fix stuff`.
- Every commit should be meaningful, descriptive, and follow the Conventional Commits standard.