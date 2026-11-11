/**
 * The trailing ↗ of a table row has two forms: the outlined button of a card row (the default, unchanged) and the bare
 * 40px button of a grid table's action column, where the column is the box.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from './live-table.fixtures';
import { OpenRowButton } from './open-row-button';

afterEach(unmountAll);

const button = (container: HTMLElement) => container.querySelector('button');

describe('OpenRowButton', () => {
  it('is the outlined card-row button unless asked for the grid form', () => {
    const { container } = mount(<OpenRowButton label="Open Maya Chen in new tab" onClick={() => {}} />);
    expect(button(container)?.className).toContain('bg-ods-card');
    expect(button(container)?.className).not.toContain('border-0');
    expect(button(container)?.getAttribute('aria-label')).toBe('Open Maya Chen in new tab');
  });

  it('draws no border or fill of its own in a grid action column', () => {
    const { container } = mount(<OpenRowButton grid label="Open Maya Chen in new tab" onClick={() => {}} />);
    expect(button(container)?.className).toContain('border-0');
    expect(button(container)?.className).toContain('size-10');
    expect(button(container)?.className).not.toContain('bg-ods-card');
  });

  it('opens on click in both forms and never lets the row behind it take the click', () => {
    const onClick = vi.fn();
    const { container } = mount(<OpenRowButton grid label="Open in new tab" onClick={onClick} />);
    button(container)?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-no-row-click]')).not.toBeNull();
  });
});
