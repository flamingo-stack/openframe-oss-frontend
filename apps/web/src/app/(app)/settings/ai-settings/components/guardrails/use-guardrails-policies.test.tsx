/**
 * A preset switch keeps the previous preset's rules on screen until the new ones land (no skeleton flash), and a
 * picker reads every preset's rules ahead so the switch is instant.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGuardrailsTemplate, usePrefetchGuardrailsTemplates } from './use-guardrails-policies';

const spies = vi.hoisted(() => ({
  post: vi.fn<(url: string, body: { variables?: { id?: string } }) => Promise<unknown>>(),
}));

vi.mock('@/lib/api-client', () => ({ apiClient: { post: spies.post } }));

function policy(id: string) {
  return {
    ok: true,
    data: {
      data: {
        guardrailPolicy: {
          policyId: id,
          displayName: id,
          type: 'TEMPLATE',
          isActive: false,
          sourceTemplate: null,
          rules: [],
          customOverrides: [],
        },
      },
    },
  };
}

type TemplateState = ReturnType<typeof useGuardrailsTemplate>;

let root: Root | null = null;
let client: QueryClient;

function TemplateProbe({ id, onState }: { id: string; onState: (state: TemplateState) => void }) {
  const state = useGuardrailsTemplate(id);
  useEffect(() => onState(state));
  return null;
}

function PrefetchProbe({ enabled }: { enabled: boolean }) {
  usePrefetchGuardrailsTemplates(['a', 'b'], enabled);
  return null;
}

function mount(node: React.ReactNode) {
  if (!root) {
    root = createRoot(document.createElement('div'));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }
  act(() => root?.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
}

/** Lets the queries settle (react-query notifies on a timer) and React render what they hold. */
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  spies.post.mockReset();
});

describe('useGuardrailsTemplate', () => {
  it("keeps the previous template's rules while the next one is read", async () => {
    let release: (value: unknown) => void = () => {};
    spies.post.mockImplementation((_url, body) =>
      body.variables?.id === 'b' ? new Promise(resolve => (release = resolve)) : Promise.resolve(policy('a')),
    );
    const seen: { current: TemplateState | null } = { current: null };
    const onState = (state: TemplateState) => {
      seen.current = state;
    };
    mount(<TemplateProbe id="a" onState={onState} />);
    await settle();
    expect(seen.current?.template?.id).toBe('a');

    mount(<TemplateProbe id="b" onState={onState} />);
    expect(seen.current?.isLoading).toBe(false);
    expect(seen.current?.isSwitching).toBe(true);
    expect(seen.current?.template?.id).toBe('a');

    release(policy('b'));
    await settle();
    expect(seen.current?.template?.id).toBe('b');
    expect(seen.current?.isSwitching).toBe(false);
  });
});

describe('usePrefetchGuardrailsTemplates', () => {
  it("reads every template's rules ahead, only while enabled", async () => {
    spies.post.mockImplementation((_url, body) => Promise.resolve(policy(body.variables?.id ?? '')));
    mount(<PrefetchProbe enabled={false} />);
    await settle();
    expect(spies.post).not.toHaveBeenCalled();

    mount(<PrefetchProbe enabled />);
    await settle();
    expect(spies.post.mock.calls.map(([, body]) => body.variables?.id)).toEqual(['a', 'b']);
  });
});
