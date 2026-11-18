/**
 * The AI Settings title row keeps its height on a phone and a narrow tablet between view mode (Edit as an icon
 * button beside the title) and edit mode (Save in the bottom bar, nothing beside the title).
 */

import { ColumnBackSlot, useColumnBack } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const safeBack = vi.hoisted(() => vi.fn());
vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => safeBack }));

import { AiSettingsLayout } from './ai-settings-layout';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const EDIT: PageActionButton[] = [{ label: 'Edit Settings', variant: 'outline', onClick: vi.fn() }];
const SAVE: PageActionButton[] = [{ label: 'Save Settings', variant: 'accent', onClick: vi.fn() }];

function render(actions: PageActionButton[] | undefined, editing: boolean) {
  act(() =>
    root.render(
      <AiSettingsLayout actions={actions} mobileBottomActions={editing}>
        <p>body</p>
      </AiSettingsLayout>,
    ),
  );
}

const slot = () => container.querySelector('[data-testid="ai-settings-header-actions"]');
/** The header's buttons drawn below md: the phone's icon buttons (the Back link and the labelled ones are md and up). */
const phoneButtons = () =>
  [...(slot()?.querySelectorAll('button') ?? [])].filter(button => /(?:^|\s)md:hidden(?:\s|$)/.test(button.className));

describe('AiSettingsLayout title row below md', () => {
  // jsdom has no layout: the classes are the contract. 44px is the lib Button's `icon` size there (h-11).
  it.each([
    ['view mode, Edit beside the title', EDIT, false, 1],
    ['edit mode, Save in the bottom bar', SAVE, true, 0],
    ['no actions (a load error)', undefined, false, 0],
  ])('reserves an icon button height in %s', (_, actions, editing, icons) => {
    render(actions, editing);
    expect(slot()?.className).toMatch(/(?:^|\s)max-md:min-h-11(?:\s|$)/);
    expect(phoneButtons()).toHaveLength(icons);
    for (const button of phoneButtons()) expect(button.className).toMatch(/(?:^|\s)h-11(?:\s|$)/);
  });
});

/** The page column header's side of the slot: what `ManhattanPageHeader` reads. */
function HeaderBack() {
  const back = useColumnBack();
  return back ? (
    <button type="button" data-testid="header-back" onClick={back.onClick}>
      {back.label}
    </button>
  ) : null;
}

function renderInSlot(enabled: boolean) {
  act(() =>
    root.render(
      <ColumnBackSlot enabled={enabled}>
        <HeaderBack />
        <AiSettingsLayout>
          <p>body</p>
        </AiSettingsLayout>
      </ColumnBackSlot>,
    ),
  );
}

/** The page's own Back, above the title. */
const pageBacks = () => [...container.querySelectorAll('header button')].filter(b => b.textContent === 'Back');
const headerBack = () => container.querySelector<HTMLButtonElement>('[data-testid="header-back"]');

describe("AiSettingsLayout Back in the page column's header (CU-17tkuw67ep4)", () => {
  it('beside the chat: one Back, in the header, running the page handler', () => {
    safeBack.mockClear();
    renderInSlot(true);
    expect(pageBacks()).toHaveLength(0);
    expect(headerBack()?.textContent).toBe('Back');
    act(() => headerBack()?.click());
    expect(safeBack).toHaveBeenCalledOnce();
  });

  it('with no header to take it (one column, no slot): the page keeps its own Back', () => {
    renderInSlot(false);
    expect(headerBack()).toBeNull();
    expect(pageBacks()).toHaveLength(1);
    render(EDIT, false);
    expect(pageBacks()).toHaveLength(1);
  });

  it('the header turned off after the first render (compact known after mount): one Back, in the page', () => {
    renderInSlot(true);
    renderInSlot(false);
    expect(headerBack()).toBeNull();
    expect(pageBacks()).toHaveLength(1);
  });
});
