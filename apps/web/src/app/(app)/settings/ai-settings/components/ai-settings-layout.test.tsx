/**
 * The AI Settings title row keeps its height on a phone and a narrow tablet between view mode (Edit as an icon
 * button beside the title) and edit mode (Save in the bottom bar, nothing beside the title).
 */

import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => vi.fn() }));

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
