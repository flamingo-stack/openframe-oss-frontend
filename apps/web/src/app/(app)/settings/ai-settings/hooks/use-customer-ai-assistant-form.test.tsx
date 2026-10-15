/**
 * Pins the staged-avatar contract of the CLIENT screen. Save writes the AI
 * config and the ClientView in parallel and uploads the avatar only after both
 * resolve; the AI config refetch lands in between. That refetch must neither
 * drop the staged file (the upload never happened, the old avatar came back
 * after a reload) nor swap the preview back to the old avatar. The first two
 * cases fail against the previous version of the hook; the third keeps the
 * avatar following its own record once the view is refetched.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AgentAiConfig, type ClientView, getDefaultAgentAiConfig } from '../types/ai-settings';
import { type CommitAvatar, useCustomerAiAssistantForm } from './use-customer-ai-assistant-form';

const spies = vi.hoisted(() => ({
  toast: vi.fn<(options: Record<string, unknown>) => void>(),
  upload: vi.fn<(endpoint: string, file: File) => Promise<string>>(),
  remove: vi.fn<(endpoint: string) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

vi.mock('@/lib/upload-with-auth', () => ({ uploadWithAuth: spies.upload, deleteWithAuth: spies.remove }));

vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://tenant.test' } }));

const OLD_AVATAR = 'https://tenant.test/api/client-agent-settings/view-1/image?v=old';
const PREVIEW = 'blob:preview-1';

function aiConfig(updatedAt: string): AgentAiConfig {
  return { ...getDefaultAgentAiConfig('CLIENT'), id: 'ai-1', providerModel: 'claude', updatedAt };
}

function clientView(updatedAt: string, hash: string): ClientView {
  return {
    id: 'view-1',
    organizationId: null,
    assistantName: 'AI Custom',
    assistantAvatar: { imageUrl: '/client-agent-settings/view-1/image', hash },
    accentColor: '#5787EB',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt,
  };
}

const seen = {
  hook: null as ReturnType<typeof useCustomerAiAssistantForm> | null,
  commit: null as CommitAvatar | null,
};

// Recorded from an effect, after each commit, rather than during render: the
// hook rules forbid writing module state from the render body.
function Harness({ ai, view }: { ai: AgentAiConfig; view: ClientView }) {
  const result = useCustomerAiAssistantForm({
    aiConfig: ai,
    view,
    onSubmit: (_payload, commitAvatar) => {
      seen.commit = commitAvatar;
    },
  });
  useEffect(() => {
    seen.hook = result;
  });
  return null;
}

function hook() {
  if (!seen.hook) throw new Error('Harness has not rendered');
  return seen.hook;
}

function commit() {
  if (!seen.commit) throw new Error('Save was not submitted');
  return seen.commit;
}

describe('useCustomerAiAssistantForm staged avatar', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (ai: AgentAiConfig, view: ClientView) =>
    act(() => {
      root.render(<Harness ai={ai} view={view} />);
    });

  const submit = async () => {
    await act(async () => {
      await hook().handleSubmit();
    });
  };

  beforeEach(() => {
    seen.hook = null;
    seen.commit = null;
    spies.toast.mockReset();
    spies.upload.mockReset();
    spies.remove.mockClear();
    URL.createObjectURL = vi.fn(() => PREVIEW);
    URL.revokeObjectURL = vi.fn();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('uploads the staged file even when the AI config refetch lands before the commit', async () => {
    spies.upload.mockResolvedValue('/client-agent-settings/view-1/image');
    const view = clientView('2026-10-14T10:00:00Z', 'old');
    await render(aiConfig('2026-10-14T10:00:00Z'), view);
    expect(hook().avatarUrl).toBe(OLD_AVATAR);

    const file = new File(['new'], 'cat.png', { type: 'image/png' });
    act(() => hook().handleAvatarChange(file));
    expect(hook().avatarUrl).toBe(PREVIEW);

    await submit();
    // The AI config save resolved and its refetch landed; the view is not refetched yet.
    await render(aiConfig('2026-10-15T09:00:00Z'), view);
    expect(hook().avatarUrl).toBe(PREVIEW);

    await act(async () => {
      await commit()('view-1');
    });
    expect(spies.upload).toHaveBeenCalledWith('/api/client-agent-settings/view-1/image', file);
    expect(hook().avatarUrl).toMatch(/^https:\/\/tenant\.test\/api\/client-agent-settings\/view-1\/image\?v=\d+$/);
  });

  it('keeps a staged removal through the AI config refetch', async () => {
    const view = clientView('2026-10-14T10:00:00Z', 'old');
    await render(aiConfig('2026-10-14T10:00:00Z'), view);

    act(() => hook().handleAvatarRemove());
    await submit();
    await render(aiConfig('2026-10-15T09:00:00Z'), view);
    expect(hook().avatarUrl).toBeUndefined();

    await act(async () => {
      await commit()('view-1');
    });
    expect(spies.remove).toHaveBeenCalledWith('/api/client-agent-settings/view-1/image');
  });

  it('re-syncs the avatar from the server once the view itself is refetched', async () => {
    await render(aiConfig('2026-10-14T10:00:00Z'), clientView('2026-10-14T10:00:00Z', 'old'));
    act(() => hook().handleAvatarChange(new File(['new'], 'cat.png', { type: 'image/png' })));

    await render(aiConfig('2026-10-14T10:00:00Z'), clientView('2026-10-15T09:00:00Z', 'new'));
    expect(hook().avatarUrl).toBe('https://tenant.test/api/client-agent-settings/view-1/image?v=new');
  });
});
