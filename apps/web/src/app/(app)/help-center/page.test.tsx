/**
 * The Help Center header's "Contact Support" opens the support modal (CU-86akejptf).
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HelpCenterPage from './page';

interface Action {
  label?: string;
  onClick?: () => void;
}

vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  PageLayout: ({ title, actions, children }: { title: string; actions?: Action[]; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions?.map(action => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      {children}
    </div>
  ),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({ HeadphoneIcon: () => null }));
vi.mock('@/app/components/shared/contact-support-modal', () => ({
  SupportContactModal: ({ open }: { open: boolean }) => (open ? <div role="dialog">support</div> : null),
}));
vi.mock('../onboarding/components/book-call/book-call-section', () => ({ BookCallSection: () => null }));
vi.mock('./components/help-center-menu', () => ({ HelpCenterMenu: () => null }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('HelpCenterPage', () => {
  it('opens Contact Support from the header', () => {
    act(() => root.render(<HelpCenterPage />));
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const contact = [...container.querySelectorAll('button')].find(b => b.textContent === 'Contact Support');
    if (!contact) throw new Error('no Contact Support action');
    act(() => contact.click());

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
