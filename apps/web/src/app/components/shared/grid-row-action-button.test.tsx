/**
 * A row action in a grid table's action column is static chrome: it acts on a row that is read and allows the action,
 * and is drawn for real and inert on a loading row or a row that does not allow it.
 */

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GridRowActionButton } from './grid-row-action-button';
import { mount, unmountAll } from './live-table.fixtures';

afterEach(unmountAll);

const button = (container: HTMLElement) => container.querySelector('button');

describe('GridRowActionButton', () => {
  it('acts on click and never lets the row behind it take the click', () => {
    const onClick = vi.fn();
    const { container } = mount(<GridRowActionButton label="Delete session" icon={<span />} onClick={onClick} />);
    button(container)?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button(container)?.getAttribute('aria-label')).toBe('Delete session');
    expect(container.querySelector('[data-no-row-click]')).not.toBeNull();
  });

  it('is inert on a loading row: a placeholder row is never acted on', () => {
    const onClick = vi.fn();
    const { container } = mount(
      <LoadingWhen loading>
        <GridRowActionButton label="Delete session" icon={<span />} onClick={onClick} />
      </LoadingWhen>,
    );
    expect(button(container)?.disabled).toBe(true);
    button(container)?.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is inert on a row that does not allow the action', () => {
    const onClick = vi.fn();
    const { container } = mount(
      <GridRowActionButton disabled label="Delete session" icon={<span />} onClick={onClick} />,
    );
    expect(button(container)?.disabled).toBe(true);
    button(container)?.click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
