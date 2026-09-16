import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { CustomerDetailsTab } from './customer-details-tab';

// The lib `TruncateText` measures its text for the truncation tooltip; jsdom has
// no `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const BLANK_CONTACT = { name: '', title: '', email: '', phone: '' };

function customer(overrides: Partial<CustomerDetails> = {}): CustomerDetails {
  return {
    id: 'org-1',
    organizationId: 'techflow',
    name: 'TechFlow Solutions',
    industry: '-',
    website: '-',
    employees: null,
    updatedAt: '2025-08-27T14:45:00Z',
    physicalAddress: '',
    mailingAddress: '',
    primary: { ...BLANK_CONTACT },
    billing: { ...BLANK_CONTACT },
    technical: { ...BLANK_CONTACT },
    mrrUsd: null,
    contractStart: null,
    contractEnd: null,
    notes: [],
    isDefault: false,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('CustomerDetailsTab', () => {
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

  const render = (organization: CustomerDetails) => {
    act(() => root.render(<CustomerDetailsTab organization={organization} />));
  };

  const notesBody = () => {
    const heading = Array.from(container.querySelectorAll('h2')).find(h => h.textContent === 'Notes');
    const card = heading?.closest('section');
    if (!card) throw new Error('Notes card not rendered');
    return card.querySelector('p')?.textContent ?? null;
  };

  it('renders the saved notes verbatim, surrounding whitespace included', () => {
    const saved = '  indented first line\n\nlast line\n';
    render(customer({ notes: [saved] }));

    expect(notesBody()).toBe(saved);
  });

  it('shows the empty state when there are no notes', () => {
    render(customer({ notes: [] }));

    expect(notesBody()).toContain('No notes yet');
  });

  it('shows the empty state when the notes hold only whitespace', () => {
    render(customer({ notes: ['  \n\t\n '] }));

    expect(notesBody()).toContain('No notes yet');
  });
});
