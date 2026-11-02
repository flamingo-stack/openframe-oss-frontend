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

/** The Tickets step's Fae chip. */
const OPEN_FAE = 'Open Fae - your client assistant';
/** What the user can reach: a folded part stays mounted for its motion, `inert`. */
const reachable = (element: Element) => !element.closest('[inert]');
const shown = (selector: string) => [...container.querySelectorAll(selector)].filter(reachable);
const gridShown = () => shown('[data-testid="getting-started-grid"]').length > 0;
/** The text the user can read: the block without its folded parts. */
const shownText = () => {
  const copy = container.cloneNode(true) as HTMLElement;
  for (const folded of copy.querySelectorAll('[inert]')) folded.remove();
  return copy.textContent ?? '';
};
const buttons = () => [...container.querySelectorAll('button')].filter(reachable);
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
    expect(shown('li [aria-expanded="true"]')).toHaveLength(1);
    expect(button('DevicesMachines running the agent').getAttribute('aria-expanded')).toBe('true');
    expect(button('Check my device')).toBeTruthy();
  });

  it('opens the next step to do, and keeps a row the user closed closed', () => {
    render(['devices', 'tickets']);
    click(container.querySelector('button[aria-label="Show the steps"]') as Element);
    expect(button('ScriptingScripts and schedules').getAttribute('aria-expanded')).toBe('true');

    click(button('ScriptingScripts and schedules'));
    expect(shown('li [aria-expanded="true"]')).toHaveLength(0);
    render(['devices', 'tickets', 'scripting']);
    expect(shown('li [aria-expanded="true"]')).toHaveLength(0);
  });

  it('opens as the grid when the tour is picked up with steps done', () => {
    render(['devices']);
    expect(gridShown()).toBe(true);
    expect(header()).toContain('1 of 7 steps');
  });

  it('folds once progress landing after it mounted shows a step done', () => {
    render();
    expect(gridShown()).toBe(false);
    render(['devices']);
    expect(gridShown()).toBe(true);
  });

  it('stays unfolded once the user unfolds it, done steps or not', () => {
    render(['devices']);
    click(container.querySelector('button[aria-label="Show the steps"]') as Element);
    expect(gridShown()).toBe(false);
    render(['devices', 'tickets']);
    expect(gridShown()).toBe(false);
  });

  it('folds the list back into the grid from the same chevron', () => {
    render(['devices']);
    const toggle = () => container.querySelector('header button') as Element;
    expect(toggle().getAttribute('aria-label')).toBe('Show the steps');
    click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe('Hide the steps');
    click(button('TicketsTickets and time logs'));
    click(toggle());
    expect(gridShown()).toBe(true);
    // Unfolded again, it opens on the next step to do, not on the one left open.
    click(toggle());
    expect(shown('li [aria-expanded="true"]')).toHaveLength(1);
    expect(button('TicketsTickets and time logs').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens one step at a time, with its description and chips', () => {
    render();
    expect(shownText()).toContain('Every machine running the OpenFrame agent');
    expect(button('Check my device')).toBeTruthy();

    click(button('TicketsTickets and time logs'));
    expect(shownText()).toContain('Requests from your clients');
    expect(shownText()).not.toContain('Every machine running the OpenFrame agent');
  });

  it('a chip hands its step and action to the host and folds the block into the grid', () => {
    render();
    click(button('Check my device'));

    expect(onAction).toHaveBeenCalledWith(TOUR_STEPS[0], TOUR_STEPS[0].actions[0]);
    expect(shownText()).not.toContain('Try asking:');
    expect(gridShown()).toBe(true);
    // Every step is a chip of the grid.
    for (const step of TOUR_STEPS) expect(button(step.title)).toBeTruthy();
  });

  it('folds into two columns whatever the width, an odd last step across both', () => {
    render();
    click(button('Check my device'));

    // jsdom has no layout: the classes are the contract (a wide composer would fit four).
    const grid = shown('[data-testid="getting-started-grid"]')[0];
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
    expect(gridShown()).toBe(false);
    // Devices is still the next step to do: the host has not marked it done here.
    expect(button('DevicesMachines running the agent').getAttribute('aria-expanded')).toBe('true');

    click(button('LogsDevice and platform activity'));
    click(button('Errors since install'));
    click(button('Logs'));
    expect(gridShown()).toBe(false);
    expect(shownText()).toContain('What the agent logged on your devices');
  });

  it('a refused chip leaves the step open', () => {
    onAction.mockReturnValueOnce(false);
    render();
    click(button('Check my device'));

    expect(gridShown()).toBe(false);
    expect(shownText()).toContain('Try asking:');
  });

  it('disables the chips while Mingo is answering, and says so', () => {
    onAction.mockClear();
    render([], true);

    const chip = button('Check my device');
    expect(chip.matches(':disabled')).toBe(true);
    expect(shown('[role="status"]')[0]?.textContent).toBe('Mingo is answering…');
    click(chip);
    expect(onAction).not.toHaveBeenCalled();
    expect(gridShown()).toBe(false);
  });

  it('enables the chips again once Mingo is done', () => {
    onAction.mockClear();
    render([], true);
    render([], false);

    const chip = button('Check my device');
    expect(chip.matches(':disabled')).toBe(false);
    expect(shown('[role="status"]')).toHaveLength(0);
    click(chip);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('offers Open Fae on Tickets alone, live while Mingo answers, without folding', () => {
    onOpenFae.mockClear();
    onAction.mockClear();
    render([], true);
    expect(buttons().some(b => b.textContent?.trim() === OPEN_FAE)).toBe(false);

    click(button('TicketsTickets and time logs'));
    const chip = button(OPEN_FAE);
    expect(chip.matches(':disabled')).toBe(false);
    click(chip);
    expect(onOpenFae).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
    expect(gridShown()).toBe(false);
  });

  it('leaves Open Fae out where Fae cannot run', () => {
    render([], false, null);
    click(button('TicketsTickets and time logs'));
    expect(buttons().some(b => b.textContent?.trim() === OPEN_FAE)).toBe(false);
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

describe('GettingStartedBlock motion', () => {
  /** The part an element opens and folds with: a sidebar group's grid row, eased between `0fr` and `1fr`. */
  const foldOf = (element: Element | null) => element?.closest('[class*="grid-rows-["]') ?? null;
  const panel = (id: TourStepId) => container.querySelector(`#getting-started-${id}`);
  const row = (id: TourStepId) => container.querySelector(`button[aria-controls="getting-started-${id}"]`);
  const isOpen = (fold: Element | null) =>
    !!fold && !fold.hasAttribute('inert') && fold.className.includes('grid-rows-[1fr]');
  const isFolded = (fold: Element | null) =>
    !!fold &&
    fold.hasAttribute('inert') &&
    fold.className.includes('grid-rows-[0fr]') &&
    fold.className.includes('invisible');

  it("opens and folds a step as a sidebar group does, the folded one's panel kept for the way back", () => {
    render();
    expect(isOpen(panel('devices'))).toBe(true);
    expect(isFolded(panel('tickets'))).toBe(true);

    click(row('tickets') as Element);
    expect(isOpen(panel('tickets'))).toBe(true);
    expect(isFolded(panel('devices'))).toBe(true);
  });

  it('folds the list into the grid and back as one motion, each shape kept while the other shows', () => {
    render(['devices']);
    const grid = () => foldOf(container.querySelector('[data-testid="getting-started-grid"]'));
    const list = () => foldOf(row('devices'));
    expect(isOpen(grid())).toBe(true);
    expect(isFolded(list())).toBe(true);

    click(container.querySelector('header button') as Element);
    expect(isOpen(list())).toBe(true);
    expect(isFolded(grid())).toBe(true);
  });

  it("moves in the sidebar's time and curve, and stands still for reduced motion", () => {
    render();
    // The chevron is the control's last icon (a step row leads with the step's own).
    const chevron = (element: Element | null) =>
      [...(element?.querySelectorAll('svg') ?? [])].at(-1)?.getAttribute('class') ?? '';
    for (const moving of [
      panel('devices')?.className,
      foldOf(row('devices'))?.className,
      chevron(row('devices')),
      chevron(container.querySelector('header button')),
    ]) {
      expect(moving).toContain('duration-300');
      expect(moving).toContain('[transition-timing-function:cubic-bezier(0.2,0,0,1)]');
      expect(moving).toContain('motion-reduce:transition-none');
    }
    // One chevron, turned over while its part is open.
    expect(chevron(row('devices'))).toContain('rotate-180');
    expect(chevron(row('tickets'))).not.toContain('rotate-180');
  });
});

describe('GettingStartedBlock across pages and tabs', () => {
  const USER = 'u-1';
  const KEY = `openframe:getting-started-view:${USER}`;
  const grid = () => shown('[data-testid="getting-started-grid"]')[0] ?? null;
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
