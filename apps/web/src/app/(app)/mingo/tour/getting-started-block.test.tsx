/**
 * The Getting Started block's two shapes: the list opens one step at a time
 * into its chips, a chip hands the step and the chip to the host and folds the
 * block into the grid, the grid's chevron (or a step chip) unfolds it again.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GettingStartedBlock } from './getting-started-block';
import { TOUR_STEPS, type TourStepId } from './tour-steps';

// The lib `Tag` measures its label for the truncation tooltip; jsdom has no
// `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

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

const onAction = vi.fn(() => true);
const onFinish = vi.fn();

function render(done: TourStepId[] = []) {
  act(() => {
    root.render(
      <GettingStartedBlock steps={TOUR_STEPS} doneStepIds={new Set(done)} onAction={onAction} onFinish={onFinish} />,
    );
  });
}

const buttons = () => [...container.querySelectorAll('button')];
const button = (text: string) => {
  const found = buttons().find(b => b.textContent?.trim() === text);
  if (!found) throw new Error(`no button "${text}"`);
  return found;
};
const click = (el: Element) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const header = () => container.querySelector('header')?.textContent ?? '';

describe('GettingStartedBlock', () => {
  it('starts as the list with every step closed and the count at zero', () => {
    render();
    expect(header()).toContain('0 of 7 steps');
    expect(container.querySelectorAll('[aria-expanded="true"]')).toHaveLength(0);
    expect(container.textContent).not.toContain('Try asking:');
  });

  it('opens one step at a time, with its description and chips', () => {
    render();
    click(button('DevicesMachines running the agent'));
    expect(container.textContent).toContain('Every machine running the OpenFrame agent');
    expect(button('Check device')).toBeTruthy();

    click(button('TicketsTickets and time logs'));
    expect(container.textContent).toContain('Requests from your clients');
    expect(container.textContent).not.toContain('Every machine running the OpenFrame agent');
  });

  it('a chip hands its step and action to the host and folds the block into the grid', () => {
    render();
    click(button('DevicesMachines running the agent'));
    click(button('Check device'));

    expect(onAction).toHaveBeenCalledWith(TOUR_STEPS[0], TOUR_STEPS[0].actions[0]);
    expect(container.textContent).not.toContain('Try asking:');
    expect(container.querySelector('[data-testid="getting-started-grid"]')).not.toBeNull();
    // Every step is a chip of the grid.
    for (const step of TOUR_STEPS) expect(button(step.title)).toBeTruthy();
  });

  it('the grid unfolds from its chevron, or on the step whose chip was pressed', () => {
    render();
    click(button('DevicesMachines running the agent'));
    click(button('Check device'));

    click(container.querySelector('button[aria-label="Show the steps"]') as Element);
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    expect(container.querySelectorAll('[aria-expanded="true"]')).toHaveLength(0);

    click(button('LogsDevice and platform activity'));
    click(button('What changed today'));
    click(button('Logs'));
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    expect(container.textContent).toContain('Everything that happened on your devices');
  });

  it('a refused chip leaves the step open', () => {
    onAction.mockReturnValueOnce(false);
    render();
    click(button('DevicesMachines running the agent'));
    click(button('Check device'));

    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    expect(container.textContent).toContain('Try asking:');
  });

  it('counts the done steps and offers to finish on the last one', () => {
    render(['devices', 'tickets', 'scripting']);
    expect(header()).toContain('3 of 7 steps');

    click(button('Knowledge ManagementArticles for AI and team'));
    click(button('Finish tour'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
