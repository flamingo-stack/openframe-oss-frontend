/**
 * Save validates and diffs against the record the form was seeded from. A refetch that lands after the first keystroke
 * does not reseed the form (`useSeedForm`), so it must not become what Save reads either: every field the user left
 * alone would then read as changed and go out with the value the form still holds, or be refused by a rule it never
 * had to meet.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { commit, toast } = vi.hoisted(() => ({ commit: vi.fn(), toast: vi.fn() }));

// `readInlineData` hands the node back: the fixture's records carry the nested fragments' fields flat.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
  useMutation: () => [commit, false],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast }),
}));

import { LIVE_DETAILS, userRecord } from './__tests__/edit-user-fixtures';
import type { EditUserRecord } from './edit-user-form';
import { useEditUserForm } from './use-edit-user-form';

const storedUser = (department: string, usageLocation = 'GB') =>
  userRecord({ details: { ...LIVE_DETAILS, department, usageLocation } });

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useEditUserForm> | null;

function Harness({ record }: { record: EditUserRecord | null }) {
  const edit = useEditUserForm(record);
  useEffect(() => {
    hook = edit;
  });
  return null;
}

describe('useEditUserForm, Save', () => {
  beforeEach(() => {
    hook = null;
    commit.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('sends only what the user changed when a refetch lands after the first keystroke', async () => {
    act(() => root.render(<Harness record={storedUser('Design')} />));
    act(() => hook?.form.setValue('jobTitle', 'Lead', { shouldDirty: true }));
    // Someone renamed the department upstream: the dirty form keeps showing "Design".
    act(() => root.render(<Harness record={storedUser('Operations')} />));
    expect(hook?.form.getValues('department')).toBe('Design');

    await act(async () => hook?.handleSave());
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(commit.mock.calls[0]?.[0]).toMatchObject({
      variables: { input: { id: 'acc-1', organizationId: 'org-1', jobTitle: 'Lead' } },
    });
    expect(commit.mock.calls[0]?.[0].variables.input).not.toHaveProperty('department');
  });

  it('checks the usage location against the seeded record, not a refetch the form did not take', async () => {
    act(() => root.render(<Harness record={storedUser('Design', '')} />));
    act(() => hook?.form.setValue('jobTitle', 'Lead', { shouldDirty: true }));
    // Set upstream meanwhile: a stored one cannot be cleared, but the form still holds none and never touched it.
    act(() => root.render(<Harness record={storedUser('Design', 'GB')} />));

    await act(async () => hook?.handleSave());
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(commit.mock.calls[0]?.[0].variables.input).toEqual({
      id: 'acc-1',
      organizationId: 'org-1',
      jobTitle: 'Lead',
    });
  });

  it('sends nothing once a refetch finds no user, though the form keeps the seeded record', async () => {
    act(() => root.render(<Harness record={storedUser('Design')} />));
    act(() => hook?.form.setValue('jobTitle', 'Lead', { shouldDirty: true }));
    // Deleted upstream: the page's state leaves `ready`, and the form still holds what it was seeded from.
    act(() => root.render(<Harness record={null} />));
    expect(hook?.record).not.toBeNull();

    await act(async () => {
      hook?.handleSave();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(commit).not.toHaveBeenCalled();
  });
});
