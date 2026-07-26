# Contributing Guidelines

Thank you for contributing to the OpenFrame OSS Frontend! This guide covers code style conventions, branch naming, the PR process, commit message format, and review checklist.

---

## Getting Started

Before contributing, make sure you have:

1. Read the [Quick Start Guide](../../getting-started/quick-start.md)
2. Set up your [Development Environment](../setup/environment.md)
3. Joined the [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) for discussions

> **Note:** We do not use GitHub Issues or GitHub Discussions for tracking work. All coordination happens in the OpenMSP Slack community.

---

## Code Style and Conventions

### Language: TypeScript

All new code must be written in TypeScript with strict typing. Avoid:
- `any` types (use `unknown` with type guards if necessary)
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
export default function DeviceDetailsView() { ... }
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

- Use absolute imports with the `@/` alias (configured for `src/`)
- Group imports: external libraries → internal `@/lib` → internal feature → types

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

### Formatting

The project uses [Biome](https://biomejs.dev/) for all formatting. Let it do its job:

```bash
# Auto-fix formatting
npm run format:fix

# Check without fixing
npm run lint:biome
```

Do not manually configure tab/space counts or line lengths — let Biome handle it.

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
| `style/` | Pure formatting/style changes | `style/biome-format-fix` |

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

### Scope (Optional)

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

# Lint
npm run lint
npm run lint:biome

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

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run lint:biome` passes
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

```bash
mkdir -p src/app/\(app\)/my-feature/{components,hooks,queries,types,utils}
touch src/app/\(app\)/my-feature/page.tsx
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

## Getting Help

For questions about contribution process or design decisions:

- **Slack:** https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA
- **GitHub:** https://github.com/flamingo-stack/openframe-oss-frontend
