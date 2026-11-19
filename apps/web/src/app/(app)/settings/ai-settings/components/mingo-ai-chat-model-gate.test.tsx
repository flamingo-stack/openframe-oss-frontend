import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import type { AgentAiConfig } from '../types/ai-settings';
import { MingoAiChatTab } from './mingo-ai-chat-tab';

vi.mock('../hooks/use-supported-models', () => ({
  useSupportedModels: () => ({ modelsByProvider: { ANTHROPIC: [{ value: 'claude-test', label: 'Test Claude' }] } }),
  getProviderModelLabel: () => 'Test Claude',
}));
vi.mock('../hooks/use-hub-default-quick-actions', () => ({
  useHubDefaultQuickActions: () => ({ loaded: true, actions: [] }),
}));
vi.mock('./ai-settings-quick-actions', () => ({
  MINGO_QUICK_ACTIONS_CONFIG: { agentSlug: 'mingo' },
  AiSettingsQuickActionsSection: () => <div>Mingo Quick Actions</div>,
}));
vi.mock('./ai-settings-quick-actions-editor', () => ({
  AiSettingsQuickActionsEditor: () => <div>Mingo Quick Actions</div>,
}));

const CONFIG: AgentAiConfig = {
  id: 'admin-config',
  agentType: 'ADMIN',
  llmProvider: 'ANTHROPIC',
  providerModel: 'claude-test',
  answerStyle: 'STANDARD',
  customPrompt: null,
  quickActionsIsDefault: true,
  quickActions: [],
  createdAt: '2026-11-17T12:00:00Z',
  updatedAt: null,
};
let root: Root;
let container: HTMLDivElement;
const submit = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useFeatureFlagsStore.getState().reset();
  vi.unstubAllGlobals();
});
function render(flag: boolean | undefined, edit: boolean, loaded = true) {
  useFeatureFlagsStore.setState({
    flags: flag === undefined ? {} : { 'ai-mingo-chat-model-selection': flag },
    isLoaded: loaded,
  });
  act(() => root.render(<MingoAiChatTab aiConfig={CONFIG} isEditMode={edit} onSubmit={submit} />));
}

/**
 * AI Settings while the per-chat model rolls out: off (or absent) keeps the tenant-wide Mingo model, on leaves it to
 * each chat, and an unanswered flag guesses neither.
 */
describe('Mingo global model controls during rollout', () => {
  it.each([false, undefined])('preserves the legacy editor and overview when the flag is %s', flag => {
    render(flag, false);
    expect(container.textContent).toContain('Mingo LLM Provider');
    expect(container.textContent).toContain('Provider Model');
    render(flag, true);
    expect(container.textContent).toContain('Mingo LLM Provider');
    expect(container.textContent).toContain('Provider Model');
  });
  it.each([false, true])('hides only model controls with the flag on (edit=%s)', edit => {
    render(true, edit);
    expect(container.textContent).not.toContain('Mingo LLM Provider');
    expect(container.textContent).not.toContain('Provider Model');
    expect(container.textContent).toContain('Answer Style');
    expect(container.textContent).toContain('Mingo Quick Actions');
  });
  it.each([false, true])('stays in its loading state until the flag answers (edit=%s)', edit => {
    render(undefined, edit, false);
    expect(container.textContent).toContain('Mingo LLM Provider');
    expect(container.textContent).not.toContain('Test Claude');

    render(false, edit);
    expect(container.textContent).toContain('Test Claude');
  });
  it('submits the unchanged hidden legacy model and other settings', async () => {
    render(true, true);
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        llmProvider: 'ANTHROPIC',
        providerModel: 'claude-test',
        answerStyle: 'STANDARD',
        quickActionsIsDefault: true,
      }),
    );
  });
});
