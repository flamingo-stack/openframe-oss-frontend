import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoComposerSheet, SHEET_DEFAULT_HEIGHT } from './mingo-composer-sheet';
import { useMingoSheetStore } from './mingo-sheet-store';

interface SheetProps {
  open: boolean;
  height: number | null;
  defaultShare?: number;
  resizable?: boolean;
  onDismiss: () => void;
  children?: ReactNode;
}
const sheet = { props: null as SheetProps | null };
const viewport = { mdUp: true as boolean | undefined };

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  ComposerSheet: (props: SheetProps) => {
    sheet.props = props;
    return <div>{props.children}</div>;
  },
}));
// The list has tests of its own (and reads the session's chat state): here, where it shows.
vi.mock('./mingo-phone-chat-list', () => ({ MingoPhoneChatList: () => <p>chat list</p> }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useMdUp: () => viewport.mdUp }));
const location = { pathname: '/devices/', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({ useMingoChatThreadOnScreen: () => {} }));
vi.mock('@/lib/native-back', () => ({ useNativeBackDismissible: () => {} }));

let container: HTMLDivElement;
let root: Root;
const render = () => act(() => root.render(<MingoComposerSheet />));

describe('MingoComposerSheet height', () => {
  beforeEach(() => {
    sheet.props = null;
    viewport.mdUp = true;
    location.pathname = '/devices/';
    location.search = '';
    useMingoSheetStore.setState({ open: false, openAfterNavigation: false, height: null, node: null, lastPage: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens 500px tall on a desktop until it is dragged', () => {
    render();
    expect(SHEET_DEFAULT_HEIGHT).toBe(500);
    expect(sheet.props?.height).toBe(500);
  });

  it('keeps the height the user dragged it to', () => {
    useMingoSheetStore.setState({ height: 640 });
    render();
    expect(sheet.props?.height).toBe(640);
  });

  it('takes the whole screen on a phone, with no resize tab, whatever height was dragged', () => {
    viewport.mdUp = false;
    useMingoSheetStore.setState({ height: 640 });
    render();
    expect(sheet.props?.height).toBeNull();
    expect(sheet.props?.defaultShare).toBe(1);
    expect(sheet.props?.resizable).toBe(false);
  });
});

describe('MingoComposerSheet way back', () => {
  beforeEach(() => {
    location.pathname = '/devices/';
    location.search = '';
    useMingoSheetStore.setState({ open: false, openAfterNavigation: false, node: null, lastPage: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('remembers the page on screen, with its query, as the one the chat page collapses to', () => {
    location.search = 'statuses=ONLINE';
    render();
    expect(useMingoSheetStore.getState().lastPage).toBe('/devices/?statuses=ONLINE');

    location.pathname = '/mingo/chat/';
    location.search = 'id=a';
    render();
    expect(useMingoSheetStore.getState().lastPage).toBe('/devices/?statuses=ONLINE');
  });

  it("remembers the last page outside Mingo, where a phone's top bar × leaves Mingo for", () => {
    location.search = 'statuses=ONLINE';
    render();
    expect(useMingoSheetStore.getState().outsidePage).toBe('/devices/?statuses=ONLINE');

    location.pathname = '/mingo/';
    location.search = '';
    render();
    location.pathname = '/mingo/chat/';
    location.search = 'id=a';
    render();
    expect(useMingoSheetStore.getState().outsidePage).toBe('/devices/?statuses=ONLINE');
  });

  it('keeps the sheet open over a query change on the same page', () => {
    render();
    act(() => useMingoSheetStore.getState().show());
    location.search = 'statuses=ONLINE';
    render();
    expect(useMingoSheetStore.getState().open).toBe(true);
  });
});

describe("MingoComposerSheet: a phone's chat list", () => {
  beforeEach(() => {
    sheet.props = null;
    viewport.mdUp = false;
    location.pathname = '/devices/';
    location.search = '';
    useMingoSheetStore.setState({ open: false, listOpen: false, openAfterNavigation: false, node: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('holds the list over the page, the whole screen, and closes on its scrim', () => {
    render();
    expect(container.textContent).not.toContain('chat list');
    act(() => useMingoSheetStore.getState().showList());
    expect(sheet.props).toMatchObject({ open: true, height: null, resizable: false });
    expect(container.textContent).toContain('chat list');

    act(() => sheet.props?.onDismiss());
    expect(useMingoSheetStore.getState().listOpen).toBe(false);
    expect(sheet.props?.open).toBe(false);
  });

  it('lets the list go on any navigation (a chat picked in it, Start New Chat)', () => {
    render();
    act(() => useMingoSheetStore.getState().showList());
    location.pathname = '/mingo/chat/';
    location.search = 'id=a';
    render();
    expect(useMingoSheetStore.getState().listOpen).toBe(false);
  });

  it('draws no list on a desktop, where the sidebar holds the chats', () => {
    viewport.mdUp = true;
    render();
    act(() => useMingoSheetStore.getState().showList());
    expect(sheet.props?.open).toBe(false);
    expect(container.textContent).not.toContain('chat list');
  });
});
