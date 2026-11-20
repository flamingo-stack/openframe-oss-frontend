/**
 * The desktop shell's "Update to v…" button in the sidebar. A sidebar dragged narrow
 * (200px) is thinner than the label, so expanded the label must truncate inside the
 * button and the full version stay one hover away; the 56px rail shows the glyph alone.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDesktopUpdateStore } from '@/stores/desktop-update-store';
import { SidebarUpdateButton } from './sidebar-update-button';

let container: HTMLDivElement;
let root: Root;
const initial = useDesktopUpdateStore.getState();

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useDesktopUpdateStore.setState(initial, true);
});

function render(minimized: boolean) {
  act(() => root.render(<SidebarUpdateButton minimized={minimized} />));
  return container.querySelector('button');
}

describe('SidebarUpdateButton', () => {
  it('renders nothing while no update is waiting', () => {
    expect(render(false)).toBeNull();
  });

  describe('with an update waiting', () => {
    beforeEach(() => {
      useDesktopUpdateStore.setState({ available: true, version: '1.0.28' });
    });

    it('expanded, truncates the label inside the button and keeps the full version on hover', () => {
      const button = render(false);
      const label = button?.querySelector('span.truncate');

      expect(label?.textContent).toBe('Update to v1.0.28');
      expect(label?.classList.contains('min-w-0')).toBe(true);
      expect(button?.getAttribute('title')).toBe('Update to v1.0.28');
    });

    it('sits 12px above and below with no side inset, expanded and in the rail', () => {
      for (const minimized of [false, true]) {
        expect(render(minimized)?.parentElement?.className).toBe('py-[var(--spacing-system-sf)]');
      }
    });

    it('in the rail, shows the glyph alone, named by its aria-label and title', () => {
      const button = render(true);

      expect(button?.textContent).toBe('');
      expect(button?.querySelector('svg')).not.toBeNull();
      // New Chat's box in the rail: 40px tall across the column, not the 48px icon square.
      expect(button?.classList.contains('h-10')).toBe(true);
      expect(button?.classList.contains('w-full')).toBe(true);
      expect(button?.getAttribute('aria-label')).toBe('Update to v1.0.28');
      expect(button?.getAttribute('title')).toBe('Update to v1.0.28');
    });

    it('reopens the update modal on click', () => {
      const button = render(false);
      act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

      expect(useDesktopUpdateStore.getState().isModalOpen).toBe(true);
    });
  });
});
