import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { CustomerDetailsTab } from './customer-details-tab';

const BLANK_CONTACT = { name: '', title: '', email: '', phone: '' };

function customer(overrides: Partial<CustomerDetails> = {}): CustomerDetails {
  return {
    id: 'org-1',
    organizationId: 'techflow',
    name: 'TechFlow Solutions',
    // `mapOrganization` writes '-' — not '' — when the API returns nothing.
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

  // The Notes card is the tab's only <section>: a heading plus one paragraph —
  // either the notes themselves or the empty state.
  const notesCard = () => {
    const section = container.querySelector('section');
    if (!section) throw new Error('Notes card not rendered');
    return { title: section.querySelector('h2')?.textContent, body: section.querySelector('p')?.textContent };
  };

  it('shows the notes the edit form saved, line breaks intact', () => {
    render(customer({ notes: ['Cleared 8GB from temp files.\nDisk usage back to 61%.'] }));

    expect(notesCard()).toEqual({ title: 'Notes', body: 'Cleared 8GB from temp files.\nDisk usage back to 61%.' });
  });

  it('points at the edit form when there are no notes yet', () => {
    render(customer());

    expect(notesCard().body).toContain('No notes yet');
  });

  it('treats whitespace-only notes as no notes', () => {
    // The textarea can be saved holding nothing but blank lines.
    render(customer({ notes: ['  \n\t\n '] }));

    expect(notesCard().body).toContain('No notes yet');
  });

  it('still renders the website link and the address cells', () => {
    render(customer({ website: 'techflow.com', physicalAddress: '1250 Tech Blvd, Austin, TX' }));

    expect(container.querySelector('a[href="https://techflow.com"]')).not.toBeNull();
    expect(container.textContent).toContain('1250 Tech Blvd, Austin, TX');
    expect(container.textContent).toContain('Mailing Address');
  });
});
