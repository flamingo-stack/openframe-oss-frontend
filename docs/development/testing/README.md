# Testing Overview

This document covers the testing approach for the OpenFrame OSS Frontend, including how to run tests, the test structure, and guidelines for writing new tests.

---

## Testing Philosophy

The OpenFrame OSS Frontend focuses testing efforts on:

1. **Type safety** via TypeScript type checking (catches entire classes of bugs at compile time)
2. **Static analysis** via Biome and ESLint (catches antipatterns and style issues)
3. **Relay compiler validation** (ensures all GraphQL fragments are valid against the schema)
4. **Integration and E2E testing** for critical user flows (handled at the platform level)

---

## Running Tests

### Type Checking (Most Important)

TypeScript type checking is the primary "test" layer for catching bugs before runtime:

```bash
npm run type-check
```

This runs `tsc --noEmit` and reports any type errors without emitting files. This should be clean before any PR is merged.

### Linting

```bash
# ESLint (TypeScript/TSX files)
npm run lint

# Biome (all files)
npm run lint:biome
```

Both tools catch:
- Unused variables and imports
- Type unsafe patterns
- Security antipatterns (e.g., `dangerouslySetInnerHTML`)
- Relay-specific issues (`eslint-plugin-relay`)
- Import cycle issues

### Relay Compiler Validation

The Relay compiler validates that all GraphQL operations are consistent with the backend schema:

```bash
npm run relay
```

If the relay compiler exits with errors, your GraphQL fragments or queries are invalid. Fix the schema issues before proceeding.

---

## Test Structure

The project does not currently include a dedicated unit/component test runner (no `jest` or `vitest` configuration in the main package). Testing is performed at these levels:

| Level | Tool | What It Tests |
|-------|------|---------------|
| Static types | TypeScript (`tsc`) | Type correctness, interface compatibility |
| Linting | ESLint + Biome | Code quality, security antipatterns |
| GraphQL | Relay compiler | Fragment validity vs schema |
| Integration | Platform-level E2E | User flows (separate test suite) |

---

## Writing TypeScript-Safe Code

Since TypeScript type checking is the primary mechanism for catching bugs, writing well-typed code is equivalent to writing tests.

### Prefer Specific Types Over `any`

```typescript
// ✅ Typed - errors are caught at compile time
const device: Device = useDeviceDetails(deviceId);

// ❌ Unsafe - no compile-time protection
const device: any = useDeviceDetails(deviceId);
```

### Use Discriminated Unions for State

```typescript
// ✅ TypeScript catches missing cases
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Device[] }
  | { status: 'error'; error: Error };

function render(state: RequestState) {
  switch (state.status) {
    case 'idle': return null;
    case 'loading': return <Spinner />;
    case 'success': return <DeviceList devices={state.data} />;
    case 'error': return <ErrorMessage error={state.error} />;
  }
}
```

### Validate External Data with Zod

```typescript
import { z } from 'zod';

const apiResponseSchema = z.object({
  devices: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['online', 'offline', 'archived']),
  })),
});

// Parse and validate at API boundaries
const validated = apiResponseSchema.parse(rawApiResponse);
```

---

## Writing New Hooks (Testable Patterns)

New hooks should follow the established patterns to be verifiable by type checking:

```typescript
// Example: well-typed hook for data fetching
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface MyData {
  id: string;
  name: string;
}

export function useMyData(id: string) {
  return useQuery({
    queryKey: ['my-data', id],
    queryFn: async (): Promise<MyData> => {
      const { data, error } = await apiClient.get<MyData>(`/api/my-data/${id}`);
      if (error || !data) throw new Error(error ?? 'Unknown error');
      return data;
    },
    enabled: Boolean(id),
  });
}
```

Key patterns:
- Explicit return types on `queryFn`
- Enabled guard for required parameters
- Error propagation via thrown errors (not silent failures)
- Query key arrays for cache key management

---

## GraphQL Fragment Testing

Relay fragments are validated by the Relay compiler against the backend schema. To verify your fragments are correct:

```bash
# Validate and compile all fragments
npm run relay

# Fetch latest schema first if backend changed
npm run fetch-schema
npm run relay
```

If a fragment references a field that doesn't exist in the schema, the Relay compiler will fail with a descriptive error.

---

## Pre-Commit Checks

The project uses Husky to enforce quality checks on every commit. The pre-commit hook runs:

1. TypeScript type checking
2. Biome linting/formatting checks

This means type errors and lint violations are caught before they can be pushed to the repository.

---

## Coverage Requirements

While there is no automated coverage threshold enforced by a test runner, the following should be met before a PR is merged:

- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run lint:biome` passes with 0 errors
- [ ] `npm run relay` compiles successfully
- [ ] New hooks have explicit TypeScript return types
- [ ] New API-consuming code validates responses with Zod where the schema is uncertain

---

## Platform-Level E2E Testing

End-to-end testing for critical user flows (login, device registration, ticket creation, script execution) is handled by the platform-level test infrastructure in the `openframe-oss-lib` test service core. These tests run against a full deployed environment and are outside the scope of this repository.

---

## Getting Help

If you encounter testing issues or have questions about the testing approach, reach out in the [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA).
