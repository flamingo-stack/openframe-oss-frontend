import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoComposerSheet, SHEET_DEFAULT_HEIGHT } from './mingo-composer-sheet';
import { useMingoSheetStore } from './mingo-sheet-store';

interface SheetProps {
  open: boolean;
  height: number | null;
  defaultShare?: number;
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
vi.mock('next/navigation', () => ({ usePathname: () => '/devices/' }));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({ useMingoChatThreadOnScreen: () => {} }));
vi.mock('@/lib/native-back', () => ({ useNativeBackDismissible: () => {} }));

let container: HTMLDivElement;
let root: Root;
const render = () => act(() => root.render(<MingoComposerSheet />));

describe('MingoComposerSheet height', () => {
  beforeEach(() => {
    sheet.props = null;
    viewport.mdUp = true;
    useMingoSheetStore.setState({ open: false, openAfterNavigation: false, height: null, node: null });
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

  it('opens at a share of the screen on a phone', () => {
    viewport.mdUp = false;
    render();
    expect(sheet.props?.height).toBeNull();
    expect(sheet.props?.defaultShare).toBe(0.88);
  });
});
