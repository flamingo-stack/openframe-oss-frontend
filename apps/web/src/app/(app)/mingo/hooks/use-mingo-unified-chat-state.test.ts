import { afterEach, describe, expect, it } from 'vitest';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { useMingoContextStore } from '../stores/mingo-context-store';
import { snapshotSendContext } from './use-mingo-unified-chat-state';

/**
 * The rail's scope is a filter over the LIST, but a dialog can arrive without going
 * through the list — a shared link or a notification tap. These pin the one direction
 * the reconciliation is allowed to move in, and the two cases that must NOT move it.
 */
describe('snapshotSendContext', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    useMingoContextStore.setState({ openView: null, recentViews: [] });
    useMingoSheetStore.setState({ lastPage: null });
  });

  it('carries the page on screen and the filters in its URL', () => {
    window.history.replaceState(null, '', '/devices/?statuses=OFFLINE');

    expect(snapshotSendContext()).toMatchObject({
      currentPage: { kind: 'LIST', title: 'Devices' },
      currentList: { module: 'DEVICES', filters: [{ field: 'statuses', values: ['OFFLINE'] }] },
    });
  });

  it('carries the page a chat page was opened from', () => {
    window.history.replaceState(null, '', '/mingo/chat/?id=d-1');
    useMingoSheetStore.setState({ lastPage: '/settings/?tab=api-keys' });

    expect(snapshotSendContext().currentPage).toEqual({ kind: 'SETTINGS', title: 'Settings', section: 'api-keys' });
  });

  it("on a phone, carries from Mingo's home the page the chat list was opened over", () => {
    const matchMedia = window.matchMedia;
    // Narrower than md: no query matches.
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as typeof window.matchMedia;
    try {
      window.history.replaceState(null, '', '/mingo/');
      useMingoSheetStore.setState({ lastPage: '/devices/', newChatPage: '/devices/?statuses=OFFLINE' });
      expect(snapshotSendContext()).toMatchObject({
        currentPage: { kind: 'LIST', title: 'Devices' },
        currentList: { module: 'DEVICES', filters: [{ field: 'statuses', values: ['OFFLINE'] }] },
      });
    } finally {
      window.matchMedia = matchMedia;
      useMingoSheetStore.setState({ newChatPage: null });
    }
  });

  it("names an entity's page after the open view and carries the picker's selection", () => {
    window.history.replaceState(null, '', '/devices/details/?id=m-1');
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'm-1', label: 'MacBook' } });

    expect(snapshotSendContext({ contextItems: [{ type: 'SCRIPT', id: 's-1', label: 'Cleanup' }] })).toMatchObject({
      currentPage: { kind: 'ENTITY', title: 'Device: MacBook' },
      openView: { type: 'DEVICE', id: 'm-1' },
      contextItems: [{ type: 'SCRIPT', id: 's-1', label: 'Cleanup' }],
    });
  });
});
