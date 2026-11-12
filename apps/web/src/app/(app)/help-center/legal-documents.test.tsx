/**
 * Payment Terms set out plans, the free trial and prices. The phone apps show no billing figure, so their Help
 * Center has neither the document's card nor its page; every other build keeps both.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpCenterMenu } from './components/help-center-menu';
import { LegalPageClient } from './legal/[docType]/legal-page-client';

const state = vi.hoisted(() => ({ mobile: false, docType: 'payment', loading: false }));

const HUB_DOCUMENTS = [
  { docType: 'privacy', title: 'Privacy Policy', summary: '' },
  { docType: 'terms', title: 'Terms of Service', summary: '' },
  { docType: 'payment', title: 'Payment Terms', summary: '' },
];

vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<object>()),
  isMobileShell: () => state.mobile,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components', () => ({
  useLegalDocuments: () => ({ documents: state.loading ? [] : HUB_DOCUMENTS, isLoading: state.loading }),
  LegalDocumentPage: ({ docType }: { docType: string }) => <article>document:{docType}</article>,
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ docType: state.docType }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('../settings/components/setting-menu-item', () => ({
  SettingMenuItem: ({ href, title }: { href: string; title: string }) => <a href={href}>{title}</a>,
}));

let root: Root | null = null;

function render(node: React.ReactNode): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

const legalLinks = (container: HTMLElement) =>
  [...container.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(href => href?.includes('/legal/'));

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  state.mobile = false;
  state.docType = 'payment';
  state.loading = false;
});

describe('Help Center legal documents', () => {
  it('lists every published document on the web and in the desktop app', () => {
    expect(legalLinks(render(<HelpCenterMenu />))).toEqual([
      '/help-center/legal/privacy',
      '/help-center/legal/terms',
      '/help-center/legal/payment',
    ]);
  });

  it('leaves Payment Terms out of the list in the phone apps', () => {
    state.mobile = true;

    const container = render(<HelpCenterMenu />);

    expect(legalLinks(container)).toEqual(['/help-center/legal/privacy', '/help-center/legal/terms']);
    expect(container.textContent).not.toContain('Payment Terms');
  });

  it('draws no loading card for Payment Terms in the phone apps', () => {
    state.loading = true;
    const web = legalLinks(render(<HelpCenterMenu />));
    act(() => root?.unmount());
    state.mobile = true;

    const phone = legalLinks(render(<HelpCenterMenu />));

    expect(web).toContain('/help-center/legal/payment');
    expect(phone).not.toContain('/help-center/legal/payment');
    expect(phone).toHaveLength(web.length - 1);
  });

  it('opens the Payment Terms page on the web and in the desktop app', () => {
    expect(render(<LegalPageClient />).textContent).toBe('document:payment');
  });

  it('has no Payment Terms page in the phone apps', () => {
    state.mobile = true;

    expect(() => render(<LegalPageClient />)).toThrow('NEXT_NOT_FOUND');
  });

  it('keeps the other documents in the phone apps', () => {
    state.mobile = true;
    state.docType = 'privacy';

    expect(render(<LegalPageClient />).textContent).toBe('document:privacy');
  });

  it('leaves a type the lib does not list to the document page, in every build', () => {
    state.docType = 'cookies';
    expect(render(<LegalPageClient />).textContent).toBe('document:cookies');
    act(() => root?.unmount());
    state.mobile = true;

    expect(render(<LegalPageClient />).textContent).toBe('document:cookies');
  });
});
