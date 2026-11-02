/**
 * What goes home from the launcher: from a page it is a new chat about that page, what
 * the home's chip and the first message then read. From the chat page, about no page.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';
import { useMingoSheetStore } from './mingo-sheet-store';
import { useComposerLauncherDrain } from './use-composer-launcher-drain';

const navigate = vi.fn<(href: string) => void>();

function Harness({ route }: { route: ComposerRoute }) {
  useComposerLauncherDrain({
    handle: null,
    route,
    sendInNewDialog: async () => {},
    createIntentDialog: async () => null,
    selectDialog: () => {},
    openSheet: () => {},
    whatToAskPage: false,
    phone: true,
    navigate,
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  navigate.mockReset();
  useMingoSheetStore.setState({ outsidePage: '/incidents/', newChatPage: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useMingoLauncherStore.setState({ dockRequest: null });
  useMingoSheetStore.setState({ outsidePage: null, newChatPage: null });
  window.sessionStorage.clear();
});

describe('useComposerLauncherDrain on a phone', () => {
  it('sends a draft raised on a page home, as a new chat about that page', () => {
    act(() => {
      useMingoLauncherStore.getState().draftToMingo({ text: 'Fix this' });
      root.render(<Harness route="page" />);
    });

    expect(navigate).toHaveBeenCalledWith(routes.mingo.home);
    expect(useMingoSheetStore.getState().newChatPage).toBe('/incidents/');
  });

  it('starts a chat sent home from the chat page about no page', () => {
    act(() => {
      useMingoLauncherStore.getState().startNewChat();
      root.render(<Harness route="chat" />);
    });

    expect(navigate).toHaveBeenCalledWith(routes.mingo.home);
    expect(useMingoSheetStore.getState().newChatPage).toBeNull();
  });
});
