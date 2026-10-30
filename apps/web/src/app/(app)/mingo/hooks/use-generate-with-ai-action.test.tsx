/**
 * "Generate with AI", the Mingo segment of a create button: Mingo's mark from its identity, in
 * the button's own colour, opening Mingo on a chat created with the intent.
 */

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import type { SplitButtonIconAction } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, isValidElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIALOG_INTENT } from '../../tickets/constants';
import { useMingoLauncherStore } from '../stores/mingo-launcher-store';
import { useGenerateWithAiAction } from './use-generate-with-ai-action';

const latest: { action: SplitButtonIconAction | null } = { action: null };
/** The segment as a create button wires it: its click and its disabled state on a button. */
function Probe() {
  const action = useGenerateWithAiAction(DIALOG_INTENT.CREATE_KB_ARTICLE);
  useEffect(() => {
    latest.action = action;
  });
  return (
    <button type="button" onClick={action.onClick} disabled={action.disabled}>
      {action.icon}
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;
const render = () => act(() => root.render(<Probe />));
const action = () => {
  if (!latest.action) throw new Error('the hook did not run');
  return latest.action;
};

beforeEach(() => {
  latest.action = null;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  useMingoLauncherStore.setState({ dockMounted: false });
});

describe('useGenerateWithAiAction', () => {
  it("draws Mingo's identity mark in the button's own colour, as every Mingo icon", () => {
    render();
    const { icon } = action();
    expect(isValidElement(icon) && icon.type).toBe(AgentMark);
    expect(isValidElement<{ agent: string; color?: string }>(icon) && icon.props).toMatchObject({
      agent: 'mingo',
      color: 'currentColor',
    });
  });

  it('opens Mingo on a chat with the intent, and is inert while no chat can take it', () => {
    const startIntentChat = vi.fn();
    useMingoLauncherStore.setState({ dockMounted: false, startIntentChat });
    render();
    expect(action().disabled).toBe(true);

    act(() => useMingoLauncherStore.setState({ dockMounted: true }));
    expect(action().disabled).toBe(false);
    act(() => container.querySelector('button')?.click());
    expect(startIntentChat).toHaveBeenCalledWith(DIALOG_INTENT.CREATE_KB_ARTICLE);
  });
});
