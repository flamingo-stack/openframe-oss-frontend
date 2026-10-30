/**
 * The chat page writes its `?id` into the session's selection once, and from then on
 * follows the selection instead of fighting it: a dropped selection (the chat was
 * archived) goes home, another dialog (one the composer just created) becomes the
 * page's id, and a dialog that does not exist stays on its not-found state.
 */

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { makeFakeChat } from '../providers/__tests__/fake-mingo-chat';
import type { MingoChatState } from '../providers/mingo-chat-provider';
import { useChatPageSelection } from './use-chat-page-selection';

const replace = vi.hoisted(() => vi.fn<(href: string) => void>());
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../hooks/use-mingo-dialog-selection', () => ({ MINGO_DIALOG_NOT_FOUND: 'MINGO_DIALOG_NOT_FOUND' }));

const selectDialog = vi.fn<(id: string | null) => void>();

function Page({ dialogId, chat }: { dialogId: string | null; chat: MingoChatState | null }) {
  return <p>{useChatPageSelection(dialogId, chat)}</p>;
}

/** A fresh state object, the way the session republishes one on every change. */
function chatWith(activeDialogId: string | null, dialogError: string | null = null): MingoChatState {
  return makeFakeChat({ activeDialogId, dialogError, selectDialog: id => selectDialog(id) });
}

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => root.render(node));
}

/** What the page shows for its id. */
function status() {
  return container.textContent;
}

beforeEach(() => {
  replace.mockReset();
  selectDialog.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useChatPageSelection', () => {
  it('selects the page dialog once the session runs, once per id', () => {
    render(<Page dialogId="d-1" chat={null} />);
    expect(selectDialog).not.toHaveBeenCalled();
    expect(status()).toBe('starting');

    render(<Page dialogId="d-1" chat={chatWith(null)} />);
    render(<Page dialogId="d-1" chat={chatWith(null)} />);
    expect(selectDialog).toHaveBeenCalledTimes(1);
    expect(selectDialog).toHaveBeenCalledWith('d-1');

    render(<Page dialogId="d-1" chat={chatWith('d-1')} />);
    expect(status()).toBe('ready');

    render(<Page dialogId="d-2" chat={chatWith('d-1')} />);
    expect(selectDialog).toHaveBeenLastCalledWith('d-2');
    expect(selectDialog).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not follow a selection left from before the page', () => {
    render(<Page dialogId="d-1" chat={chatWith('d-other')} />);
    render(<Page dialogId="d-1" chat={chatWith('d-other')} />);

    expect(selectDialog).toHaveBeenCalledWith('d-1');
    expect(status()).toBe('starting');
    expect(replace).not.toHaveBeenCalled();
  });

  it('never re-selects its dialog over a selection that moved on', () => {
    render(<Page dialogId="d-1" chat={chatWith('d-1')} />);
    render(<Page dialogId="d-1" chat={chatWith('d-new')} />);

    expect(selectDialog).toHaveBeenCalledTimes(1);
    // The composer created a chat while this one was open: the page shows it.
    expect(replace).toHaveBeenCalledWith(routes.mingo.chat('d-new'));
  });

  it('goes home when its chat stops being the selected one (archived)', () => {
    render(<Page dialogId="d-1" chat={chatWith('d-1')} />);
    render(<Page dialogId="d-1" chat={chatWith(null)} />);

    expect(replace).toHaveBeenCalledWith(routes.mingo.home);
  });

  it('stays on the not-found state when the session drops a dialog that does not exist', () => {
    render(<Page dialogId="d-gone" chat={chatWith(null)} />);
    render(<Page dialogId="d-gone" chat={chatWith('d-gone')} />);
    render(<Page dialogId="d-gone" chat={chatWith('d-gone', 'MINGO_DIALOG_NOT_FOUND')} />);
    expect(status()).toBe('not-found');

    // The session toasts it and drops the selection.
    render(<Page dialogId="d-gone" chat={chatWith(null)} />);
    expect(status()).toBe('not-found');
    expect(replace).not.toHaveBeenCalled();
  });

  describe('with no id ("What to ask Mingo?", a chat not created yet)', () => {
    it('writes no selection, and is ready once nothing is selected', () => {
      render(<Page dialogId={null} chat={chatWith('d-before')} />);
      expect(status()).toBe('starting');
      render(<Page dialogId={null} chat={chatWith(null)} />);
      expect(status()).toBe('ready');
      expect(selectDialog).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it('does not follow the chat open before it, nor send the new chat home', () => {
      render(<Page dialogId="d-1" chat={chatWith('d-1')} />);
      // "What to ask Mingo?" from that chat page: the same page, its id gone.
      render(<Page dialogId={null} chat={chatWith('d-1')} />);
      render(<Page dialogId={null} chat={chatWith(null)} />);
      expect(replace).not.toHaveBeenCalled();
    });

    it('becomes the page of the chat a pick creates', () => {
      render(<Page dialogId={null} chat={chatWith(null)} />);
      render(<Page dialogId={null} chat={chatWith('d-new')} />);
      expect(replace).toHaveBeenCalledWith(routes.mingo.chat('d-new'));
    });

    it('is ready whatever error the session holds for the chat before it', () => {
      render(<Page dialogId={null} chat={chatWith(null, 'Network error')} />);
      expect(status()).toBe('ready');
    });
  });

  it('keeps the selection of a dialog that failed to load, for a retry', () => {
    render(<Page dialogId="d-1" chat={chatWith('d-1', 'Network error')} />);

    expect(status()).toBe('failed');
    expect(replace).not.toHaveBeenCalled();

    render(<Page dialogId="d-1" chat={chatWith('d-1')} />);
    expect(status()).toBe('ready');
  });
});
