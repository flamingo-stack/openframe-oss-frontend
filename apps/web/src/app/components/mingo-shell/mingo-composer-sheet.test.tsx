import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoComposerSheet, SHEET_DEFAULT_HEIGHT } from './mingo-composer-sheet';
import { useMingoSheetStore } from './mingo-sheet-store';

interface SheetProps {
  open: boolean;
  height: number | null;
  defaultShare?: number;
  resizable?: boolean;
}
const sheet = { props: null as SheetProps | null };
const viewport = { mdUp: true as boolean | undefined };

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  ComposerSheet: (props: SheetProps) => {
    sheet.props = props;
    return null;
  },
}));
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

  it('keeps the sheet open over a query change on the same page', () => {
    render();
    act(() => useMingoSheetStore.getState().show());
    location.search = 'statuses=ONLINE';
    render();
    expect(useMingoSheetStore.getState().open).toBe(true);
  });
});
