# Contributing to OpenFrame OSS Frontend

Thank you for your interest in contributing to the OpenFrame OSS Frontend! This guide covers everything you need to know about code style conventions, branch naming, the PR process, commit message format, and the review checklist.

---

## Before You Start

1. **Join the OpenMSP Slack community** — all coordination happens there:
   - https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA
2. **Read the [Quick Start Guide](./docs/getting-started/quick-start.md)** to get the app running locally
3. **Set up your [Development Environment](./docs/development/setup/environment.md)**

> **Note:** We do not use GitHub Issues or GitHub Discussions for tracking work. All coordination happens in the OpenMSP Slack community.

---

## Code Style and Conventions

### Language: TypeScript

All new code must be written in TypeScript with strict typing. Avoid:

- `any` types — use `unknown` with type guards if necessary
- Type assertions (`as SomeType`) unless absolutely required
- Non-null assertions (`!`) without a comment explaining why it's safe

### File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| React components | `kebab-case.tsx` | `device-details-view.tsx` |
| React hooks | `use-*.ts` or `use-*.tsx` | `use-device-details.ts` |
| Utility functions | `kebab-case.ts` | `device-action-utils.ts` |
| Type definitions | `*.types.ts` | `device.types.ts` |
| GraphQL queries | `*-queries.ts` or `*-relay.ts` | `devices-queries.ts` |
| Zustand stores | `*-store.ts` | `mingo-messages-store.ts` |

### Component Conventions

```typescript
// ✅ Named export for components
export function DeviceDetailsView({ device }: DeviceDetailsViewProps) {
  return <div>{device.name}</div>;
}

// ✅ Props interface named after component
interface DeviceDetailsViewProps {
  device: Device;
  onArchive?: () => void;
}

// ❌ Avoid default exports for components
// export default function DeviceDetailsView() { ... }
```

### Hook Conventions

```typescript
// ✅ Hooks return typed objects (not arrays) for multi-value returns
export function useDeviceDetails(deviceId: string) {
  const query = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => fetchDevice(deviceId),
  });

  return {
    device: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

### Imports

Use absolute imports with the `@/` alias (configured for `src/`). Group imports in this order: external libraries → internal `@/lib` → internal feature → types.

```typescript
// External
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// Internal infrastructure
import { apiClient } from '@/lib/api-client';
import { runtimeEnv } from '@/lib/runtime-config';

// Feature-local
import { DeviceCard } from './device-card';
import type { Device } from '../types/device.types';
```

### Linting and formatting

[ESLint](https://eslint.org/) owns the rules, [Prettier](https://prettier.io/) owns the formatting.
Neither rule set lives in this repo: both come from the shared config shipped inside
`@flamingo-stack/openframe-frontend-core` (`eslint-config/`), the same one every Flamingo frontend
loads. Its README is the reference.

```bash
npm run lint         # ESLint, the fast pass
npm run lint:fix     # ESLint autofix
npm run format:fix   # Prettier
npm run format       # Prettier, check only
```

Do not manually configure tab/space counts or line lengths — let Prettier handle it. Two things to
know before your first PR:

- **`// eslint-disable` does nothing.** `noInlineConfig` is on and the comment is itself reported as
  an error. Fix the finding, or add a named, `files:`-scoped block to `eslint.config.mjs` that says
  why it cannot be fixed.
- **CI and the pre-commit hook both run `eslint.ci.mjs`** (`npm run lint:ci`): the fast pass with
  `relay/unused-fields` switched off — the one rule still carrying a backlog (543 findings, each a
  real decision about a query's selections). It is green, so your PR is expected to keep it green.
  `npm run lint` additionally reports that backlog, and so does the editor in the file you are in.

---

## Branch Naming

Use descriptive branch names following this convention:

```text
<type>/<short-description>
```

| Type | When to Use | Example |
|------|-------------|---------|
| `feat/` | New feature | `feat/device-bulk-archive` |
| `fix/` | Bug fix | `fix/token-refresh-race-condition` |
| `chore/` | Maintenance, deps, tooling | `chore/update-relay-to-v21` |
| `refactor/` | Code refactoring without behavior change | `refactor/extract-api-client` |
| `docs/` | Documentation updates | `docs/add-architecture-diagram` |
| `style/` | Pure formatting/style changes | `style/prettier-format-fix` |

### Examples

```bash
git checkout -b feat/script-execution-history-view
git checkout -b fix/devices-table-infinite-scroll-reset
git checkout -b chore/upgrade-next-to-16-3
```

---

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Build process, dependency updates |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style` | Formatting, whitespace (no logic change) |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |

### Scope

Use the feature domain as scope when relevant:

```text
feat(devices): add bulk archive action to device table
fix(tickets): prevent duplicate approval request rendering
chore(deps): upgrade @tanstack/react-query to 5.90
```

### Summary Rules

- Use the imperative mood: "add" not "added" or "adds"
- Maximum 72 characters in the summary line
- No period at the end of the summary

---

## Pull Request Process

### Before Opening a PR

Run all quality checks locally:

```bash
# Type check
npm run type-check

# Lint + formatting
npm run lint
npm run format

# Relay compilation
npm run relay

# Verify build passes
npm run build
```

All checks must pass before the PR is submitted.

### PR Description

Include in your PR description:

- **What:** Summary of changes
- **Why:** Motivation / problem being solved
- **How:** Implementation approach (for non-obvious changes)
- **Testing:** How you verified the changes work

### PR Size Guidelines

- Keep PRs focused and reasonably sized
- One logical change per PR when possible
- Large features should be broken into smaller, reviewable PRs
- Include only changes relevant to the stated purpose

---

## Code Review Checklist

### For the Author

Before requesting review, verify:

- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run lint` reports nothing new in the files you touched
- [ ] `npm run format` passes
- [ ] `npm run relay` compiles successfully
- [ ] No hardcoded credentials, secrets, or tokens
- [ ] No `console.log` statements (use proper error handling)
- [ ] New hooks have explicit return types
- [ ] Form inputs validated with Zod
- [ ] API calls go through `apiClient` (not raw `fetch`)
- [ ] No `any` types introduced
- [ ] Commit messages follow Conventional Commits format

### For Reviewers

When reviewing a PR, check:

- [ ] Logic correctness and edge cases
- [ ] TypeScript types are accurate and not over-widened
- [ ] No security issues (XSS, exposed secrets, unvalidated input)
- [ ] Consistent with existing patterns in the codebase
- [ ] Performance implications (unnecessary re-renders, missing `useMemo`/`useCallback`)
- [ ] New queries use proper cache key arrays
- [ ] Relay fragments follow the established pattern

---

## Domain-Specific Guidelines

### Adding a New Feature Domain

Follow the existing domain structure exactly:

```text
src/app/(app)/my-feature/
├── components/     # React components (UI, forms, tables, modals)
├── hooks/          # React hooks (data fetching, mutations, UI state)
├── queries/        # GraphQL query/mutation strings
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── page.tsx        # Next.js page entry point
```

### Adding a New GraphQL Query

1. Add the query string to `src/app/(app)/<domain>/queries/<domain>-queries.ts`
2. Add the hook to `src/app/(app)/<domain>/hooks/use-<entity>.ts`
3. For Relay-based queries, add the fragment to `src/graphql/<domain>/`

### Modifying Zustand Stores

- Keep stores focused on a single domain
- Export typed selectors to avoid over-subscribing to state changes
- Do not put server state in Zustand (use TanStack Query instead)

---

## Security Guidelines

- Never store tokens, passwords, or secrets in source code
- All API calls must go through `apiClient` — never use raw `fetch` for protected endpoints
- All form inputs must be validated with Zod schemas
- Never use `dangerouslySetInnerHTML` without explicit HTML sanitization
- Variables prefixed with `NEXT_PUBLIC_` are visible to all users in the browser — never put secrets there
- Never log access tokens, refresh tokens, or user credentials

See the full [Security Overview](./docs/development/security/README.md) for details.

---

## Getting Help

For questions about the contribution process or design decisions:

- **Slack (primary):** https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA
- **OpenMSP Hub:** https://www.openmsp.ai/
- **GitHub Repository:** https://github.com/flamingo-stack/openframe-oss-frontend
- **OpenFrame Website:** https://openframe.ai

---

*Thank you for contributing to OpenFrame OSS! Every improvement helps MSPs worldwide. 💛*
