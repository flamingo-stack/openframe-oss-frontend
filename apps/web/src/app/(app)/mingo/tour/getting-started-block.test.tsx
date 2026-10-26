/**
 * The Getting Started block's two shapes: the list opens one step at a time
 * into its chips (the next step to do until the user picks one), a chip hands the step and the chip to the host and folds the
 * block into the grid, the grid's chevron (or a step chip) unfolds it again.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { GettingStartedBlock } from './getting-started-block';
import { clearGettingStartedView } from './getting-started-view';
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
  // No signed-in user here: the remembered view lives in memory, and starts empty.
  clearGettingStartedView(undefined);
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
const onOpenFae = vi.fn();

/** `openFae: null` renders the block where Fae cannot run. */
function render(done: TourStepId[] = [], busy = false, openFae: (() => void) | null = onOpenFae) {
  act(() => {
    root.render(
      <GettingStartedBlock
        steps={TOUR_STEPS}
        doneStepIds={new Set(done)}
        onAction={onAction}
        onFinish={onFinish}
        onOpenFae={openFae ?? undefined}
        busy={busy}
      />,
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
  it('starts as the list with the first step open and the count at zero', () => {
    render();
    expect(header()).toContain('0 of 7 steps');
    expect(container.querySelectorAll('li [aria-expanded="true"]')).toHaveLength(1);
    expect(button('DevicesMachines running the agent').getAttribute('aria-expanded')).toBe('true');
    expect(button('Check my device')).toBeTruthy();
  });

  it('opens the next step to do, and keeps a row the user closed closed', () => {
    render(['devices', 'tickets']);
    click(container.querySelector('button[aria-label="Show the steps"]') as Element);
    expect(button('ScriptingScripts and schedules').getAttribute('aria-expanded')).toBe('true');

    click(button('ScriptingScripts and schedules'));
    expect(container.querySelectorAll('li [aria-expanded="true"]')).toHaveLength(0);
    render(['devices', 'tickets', 'scripting']);
    expect(container.querySelectorAll('li [aria-expanded="true"]')).toHaveLength(0);
  });

  it('opens as the grid when the tour is picked up with steps done', () => {
    render(['devices']);
    expect(container.querySelector('[data-testid="getting-started-grid"]')).not.toBeNull();
    expect(header()).toContain('1 of 7 steps');
  });

  it('folds once progress landing after it mounted shows a step done', () => {
    render();
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    render(['devices']);
    expect(container.querySelector('[data-testid="getting-started-grid"]')).not.toBeNull();
  });

  it('stays unfolded once the user unfolds it, done steps or not', () => {
    render(['devices']);
    click(container.querySelector('button[aria-label="Show the steps"]') as Element);
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    render(['devices', 'tickets']);
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
  });

  it('folds the list back into the grid from the same chevron', () => {
    render(['devices']);
    const toggle = () => container.querySelector('header button') as Element;
    expect(toggle().getAttribute('aria-label')).toBe('Show the steps');
    click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe('Hide the steps');
    click(button('TicketsTickets and time logs'));
    click(toggle());
    expect(container.querySelector('[data-testid="getting-started-grid"]')).not.toBeNull();
    // Unfolded again, it opens on the next step to do, not on the one left open.
    click(toggle());
    expect(container.querySelectorAll('li [aria-expanded="true"]')).toHaveLength(1);
    expect(button('TicketsTickets and time logs').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens one step at a time, with its description and chips', () => {
    render();
    expect(container.textContent).toContain('Every machine running the OpenFrame agent');
    expect(button('Check my device')).toBeTruthy();

    click(button('TicketsTickets and time logs'));
    expect(container.textContent).toContain('Requests from your clients');
    expect(container.textContent).not.toContain('Every machine running the OpenFrame agent');
  });

  it('a chip hands its step and action to the host and folds the block into the grid', () => {
    render();
    click(button('Check my device'));

    expect(onAction).toHaveBeenCalledWith(TOUR_STEPS[0], TOUR_STEPS[0].actions[0]);
    expect(container.textContent).not.toContain('Try asking:');
    expect(container.querySelector('[data-testid="getting-started-grid"]')).not.toBeNull();
    // Every step is a chip of the grid.
    for (const step of TOUR_STEPS) expect(button(step.title)).toBeTruthy();
  });

  it('folds into two columns whatever the width, an odd last step across both', () => {
    render();
    click(button('Check my device'));

    // jsdom has no layout: the classes are the contract.
    const grid = container.querySelector('[data-testid="getting-started-grid"]');
    expect(grid?.className).toMatch(/(?:^|\s)grid-cols-2(?:\s|$)/);
    // In a short panel the block gives way and the grid scrolls.
    expect(grid?.className).toMatch(/(?:^|\s)overflow-y-auto(?:\s|$)/);
    expect(grid?.className).toMatch(/(?:^|\s)min-h-0(?:\s|$)/);
    const cells = [...(grid?.children ?? [])];
    expect(cells).toHaveLength(TOUR_STEPS.length);
    for (const cell of cells) expect(cell.className).toContain('last:odd:col-span-2');
  });

  it('the grid unfolds from its chevron, or on the step whose chip was pressed', () => {
    render();
    click(button('Check my device'));

    click(container.querySelector('button[aria-label="Show the steps"]') as Element);
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    // Devices is still the next step to do: the host has not marked it done here.
    expect(button('DevicesMachines running the agent').getAttribute('aria-expanded')).toBe('true');

    click(button('LogsDevice and platform activity'));
    click(button('Errors since install'));
    click(button('Logs'));
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    expect(container.textContent).toContain('What the agent logged on your devices');
  });

  it('a refused chip leaves the step open', () => {
    onAction.mockReturnValueOnce(false);
    render();
    click(button('Check my device'));

    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
    expect(container.textContent).toContain('Try asking:');
  });

  it('disables the chips while Mingo is answering, and says so', () => {
    onAction.mockClear();
    render([], true);

    const chip = button('Check my device');
    expect(chip.matches(':disabled')).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Mingo is answering…');
    click(chip);
    expect(onAction).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
  });

  it('enables the chips again once Mingo is done', () => {
    onAction.mockClear();
    render([], true);
    render([], false);

    const chip = button('Check my device');
    expect(chip.matches(':disabled')).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();
    click(chip);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('offers Open Fae on Tickets alone, live while Mingo answers, without folding', () => {
    onOpenFae.mockClear();
    onAction.mockClear();
    render([], true);
    expect(buttons().some(b => b.textContent?.trim() === 'Open Fae')).toBe(false);

    click(button('TicketsTickets and time logs'));
    const chip = button('Open Fae');
    expect(chip.matches(':disabled')).toBe(false);
    click(chip);
    expect(onOpenFae).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="getting-started-grid"]')).toBeNull();
  });

  it('leaves Open Fae out where Fae cannot run', () => {
    render([], false, null);
    click(button('TicketsTickets and time logs'));
    expect(buttons().some(b => b.textContent?.trim() === 'Open Fae')).toBe(false);
  });

  it('counts the done steps and offers to finish on the last one', () => {
    render(['devices', 'tickets', 'scripting']);
    expect(header()).toContain('3 of 7 steps');

    // Done steps fold it into the grid; the step's chip opens it on that step.
    click(button('Knowledge Management'));
    click(button('Finish tour'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('GettingStartedBlock across pages and tabs', () => {
  const USER = 'u-1';
  const KEY = `openframe:getting-started-view:${USER}`;
  const grid = () => container.querySelector('[data-testid="getting-started-grid"]');
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    } as Storage;
    vi.stubGlobal('localStorage', storage);
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
    useAuthStore.setState({ user: { id: USER, email: 'ann@example.com' } } as never);
  });

  afterEach(() => {
    useAuthStore.setState({ user: null } as never);
    vi.unstubAllGlobals();
  });

  it('opens folded when the user folded it before, with no step done', () => {
    store.set(KEY, 'collapsed');
    render();
    expect(grid()).not.toBeNull();
  });

  it('opens as the list when the user unfolded it before, steps done or not', () => {
    store.set(KEY, 'default');
    render(['devices', 'tickets']);
    expect(grid()).toBeNull();
  });

  it('remembers the chevron and a used chip', () => {
    render();
    click(button('Check my device'));
    expect(store.get(KEY)).toBe('collapsed');

    click(container.querySelector('header button') as Element);
    expect(store.get(KEY)).toBe('default');
  });

  it('a block mounted later (another page, a new tab) opens as it was left', () => {
    render();
    click(container.querySelector('header button') as Element);
    expect(store.get(KEY)).toBe('collapsed');

    act(() => root.unmount());
    root = createRoot(container);
    render();
    expect(grid()).not.toBeNull();
  });
});
