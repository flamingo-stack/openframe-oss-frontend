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

function customer(overrides: Partial<CustomerDetails> = {}): CustomerDetails {
  return {
    id: 'org-1',
    organizationId: 'techflow',
    name: 'TechFlow Solutions',
    industry: '',
    website: '',
    employees: null,
    updatedAt: '2025-08-27T14:45:00Z',
    physicalAddress: '',
    mailingAddress: '',
    contacts: [],
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

const CONTACT = { contactName: 'Jane Doe', title: 'IT Manager', email: 'jane@acme.com', phone: '+1-555-0123' };

describe('CustomerDetailsTab cards', () => {
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

  // The two StackedRowsPanel cards, in order: info, contacts.
  const panels = () => [...container.querySelectorAll<HTMLElement>('[class~="overflow-clip"]')];
  const contactsPanel = () => {
    const panel = panels()[1];
    if (!panel) throw new Error('Contacts card not rendered');
    return panel;
  };

  it('renders each contact once for desktop and split in two for mobile, dropping the last border', () => {
    render(customer({ contacts: [CONTACT, { ...CONTACT, contactName: 'John Roe', email: 'john@acme.com' }] }));

    const desktopRows = [...contactsPanel().querySelectorAll<HTMLElement>('[class~="md:flex"]')];
    const mobileRows = [...contactsPanel().querySelectorAll<HTMLElement>('[class~="md:hidden"]')];
    expect(desktopRows).toHaveLength(2);
    expect(mobileRows).toHaveLength(4);

    for (const label of ['Contact Name', 'Contact Title', 'Email Address', 'Phone Number']) {
      expect(desktopRows[0].textContent).toContain(label);
    }
    expect(desktopRows[0].textContent).toContain('jane@acme.com');
    expect(mobileRows[0].textContent).toContain('Jane Doe');
    expect(mobileRows[0].textContent).not.toContain('jane@acme.com');
    expect(mobileRows[1].textContent).toContain('jane@acme.com');
    expect(mobileRows[2].textContent).toContain('John Roe');

    expect(desktopRows[0].className).not.toContain('md:border-b-0');
    expect(desktopRows[1].className).toContain('md:border-b-0');
  });

  it('shows the empty state when there are no contacts', () => {
    render(customer({ contacts: [] }));

    expect(contactsPanel().textContent).toContain('No contacts yet');
  });

  it('links a bare website domain over https and renders a missing one as a dash without a link', () => {
    render(customer({ website: 'techflow.com' }));
    expect(panels()[0].querySelector('a')?.getAttribute('href')).toBe('https://techflow.com');

    render(customer({ website: '' }));
    expect(panels()[0].querySelector('a')).toBeNull();
    expect(panels()[0].textContent).toContain('—');
  });

  it('renders the addresses on one desktop row and two mobile rows, dashes when missing', () => {
    render(customer({ physicalAddress: '1 Main St', mailingAddress: '' }));

    const info = panels()[0];
    const desktop = info.querySelector<HTMLElement>('[class~="md:flex"]');
    const mobile = [...info.querySelectorAll<HTMLElement>('[class~="md:hidden"]')];
    expect(desktop?.textContent).toContain('1 Main St');
    expect(desktop?.textContent).toContain('Mailing Address');
    expect(desktop?.className).toContain('md:border-b-0');
    expect(mobile).toHaveLength(2);
    expect(mobile[1].textContent).toContain('—');
  });
});
