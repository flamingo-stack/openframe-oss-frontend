/**
 * The Assigned Tickets table: one row per linked ticket with its number,
 * assignee and status, the search narrowing it by title or number, and the
 * row's buttons unassigning or opening the ticket.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordingTicket } from './recording-tickets';
import { RecordingTicketsSection } from './recording-tickets-section';

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/devices/details/remote-session',
  useSearchParams: () => new URLSearchParams(),
}));

// The table measures its cells for truncation; jsdom has no `ResizeObserver`.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const TICKETS: RecordingTicket[] = [
  {
    id: 't-1',
    ticketNumber: 3891,
    title: 'Page not found error',
    statusName: 'TODO',
    statusKind: 'CUSTOM',
    statusColor: '#2890FA',
    assignedName: 'Roman Smith',
    assignedAvatarUrl: 'https://cdn.example/roman.png',
    createdAt: '2026-10-15T09:00:00.000Z',
  },
  {
    id: 't-2',
    ticketNumber: 3902,
    title: 'Printer offline',
    statusName: 'Tech Required',
    statusKind: 'TECH_REQUIRED',
    statusColor: null,
    assignedName: null,
    assignedAvatarUrl: null,
    createdAt: null,
  },
];

let container: HTMLDivElement;
let root: Root;
const onUnassign = vi.fn();

function render() {
  act(() => root.render(<RecordingTicketsSection tickets={TICKETS} onUnassign={onUnassign} />));
}

const text = () => container.textContent ?? '';
const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>(`[aria-label="${label}"]`));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('RecordingTicketsSection', () => {
  it('lists every linked ticket with its number, assignee and status, and counts them', () => {
    render();
    expect(text()).toContain('Assigned Tickets');
    expect(text()).toContain('Page not found error');
    expect(text()).toContain('3891');
    expect(text()).toContain('Roman Smith');
    expect(text()).toContain('Printer offline');
    expect(text()).toContain('2 results');
  });

  it("shows the assignee's photo and the ticket's age beside its number, the full time on hover", () => {
    render();
    expect(container.querySelector('img[alt="Roman Smith"]')?.getAttribute('src')).toBe(
      'https://cdn.example/roman.png',
    );
    const meta = Array.from(container.querySelectorAll<HTMLElement>('[title]')).find(el =>
      el.textContent?.startsWith('3891 • '),
    );
    expect(meta?.textContent).toMatch(/^3891 • .+/);
    expect(meta?.getAttribute('title')).toBeTruthy();
    // A ticket with no creation time reads its number alone.
    expect(text()).toContain('3902');
    expect(text()).not.toContain('3902 • ');
  });

  it('narrows the rows by title or ticket number', () => {
    render();
    const input = container.querySelector<HTMLInputElement>('input[placeholder="Search for Tickets"]');
    if (!input) throw new Error('no search input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setValue?.call(input, '3902');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(text()).toContain('Printer offline');
    expect(text()).not.toContain('Page not found error');
  });

  it('unassigns or opens the ticket of the row', () => {
    render();
    act(() => button('Unassign ticket')[1].click());
    expect(onUnassign).toHaveBeenCalledWith(TICKETS[1]);
    act(() => button('Open ticket')[0].click());
    expect(router.push).toHaveBeenCalledWith('/tickets/dialog?id=t-1');
  });
});
