/**
 * The routes that belong to one shell resolve themselves in the other: each renders
 * its page in its own variant, redirects to its classic equivalent on a definite
 * classic answer, and decides nothing while the variant is unanswered.
 */

import type { ComponentType } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toGlobalId } from '@/lib/relay-id';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import ApprovalsPage from './approvals/page';
import Dashboard from './dashboard/page';
import MingoArchivePage from './mingo/archive/page';
import MingoChatPage from './mingo/chat/page';
import MingoHomePage from './mingo/page';

const replace = vi.hoisted(() => vi.fn<(href: string) => void>());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  CompactPageLoader: () => <p>loader</p>,
}));
vi.mock('@/app/(app)/dashboard/components/dashboard-content', () => ({ default: () => <p>dashboard</p> }));
vi.mock('@/app/(app)/mingo/home/mingo-home', () => ({ MingoHome: () => <p>mingo home</p> }));
vi.mock('@/app/(app)/mingo/chat/mingo-chat-view', () => ({
  MingoChatView: ({ dialogId }: { dialogId: string }) => <p>chat {dialogId}</p>,
}));
vi.mock('@/app/(app)/mingo/archive/mingo-archive-view', () => ({
  MingoArchiveView: () => <p>archive</p>,
}));
vi.mock('@/app/(app)/approvals/approvals-view', () => ({ ApprovalsView: () => <p>approvals</p> }));

const RAW = '6ac4e3a3fb523d620947f238';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  replace.mockReset();
  useFeatureFlagsStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, '', '/');
});

function renderAt(url: string, Page: ComponentType, mingoFirst?: boolean) {
  window.history.replaceState(null, '', url);
  if (mingoFirst !== undefined) {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: mingoFirst }]);
  }
  act(() => root.render(<Page />));
}

describe('while the variant is unanswered', () => {
  it.each([
    ['/mingo', MingoHomePage],
    [`/mingo/chat?id=${RAW}`, MingoChatPage],
    ['/mingo/archive', MingoArchivePage],
    ['/approvals', ApprovalsPage],
    ['/dashboard', Dashboard],
  ] as const)('%s shows a loader and redirects nowhere', (url, Page) => {
    renderAt(url, Page);
    expect(container.textContent).toBe('loader');
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('the Mingo-first shell', () => {
  it('renders its own pages', () => {
    renderAt('/mingo', MingoHomePage, true);
    expect(container.textContent).toBe('mingo home');
    renderAt(`/mingo/chat?id=${RAW}`, MingoChatPage, true);
    expect(container.textContent).toBe(`chat ${RAW}`);
    renderAt('/mingo/archive', MingoArchivePage, true);
    expect(container.textContent).toBe('archive');
    renderAt('/approvals', ApprovalsPage, true);
    expect(container.textContent).toBe('approvals');
    expect(replace).not.toHaveBeenCalled();
  });

  it('forwards the dashboard to Mingo home, query and fragment kept', () => {
    renderAt('/dashboard?mingoDialog=d-1#top', Dashboard, true);
    expect(container.textContent).toBe('loader');
    expect(replace).toHaveBeenCalledWith('/mingo?mingoDialog=d-1#top');
  });

  it('swaps a Relay global chat id in the URL for the raw one', () => {
    renderAt(`/mingo/chat?id=${toGlobalId('Dialog', RAW)}`, MingoChatPage, true);
    expect(replace).toHaveBeenCalledWith(`/mingo/chat?id=${RAW}`);
  });

  it('sends a chat link without an id to Mingo home', () => {
    renderAt('/mingo/chat', MingoChatPage, true);
    expect(replace).toHaveBeenCalledWith('/mingo');
  });
});

describe('the classic shell', () => {
  it('renders the dashboard', () => {
    renderAt('/dashboard', Dashboard, false);
    expect(container.textContent).toBe('dashboard');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends Mingo home to the dashboard, query and fragment kept', () => {
    renderAt('/mingo?mingoDialog=d-1#top', MingoHomePage, false);
    expect(replace).toHaveBeenCalledWith('/dashboard?mingoDialog=d-1#top');
  });

  it('opens a chat link in the drawer over the dashboard', () => {
    renderAt(`/mingo/chat?id=${toGlobalId('Dialog', RAW)}`, MingoChatPage, false);
    expect(replace).toHaveBeenCalledWith(`/dashboard?mingoDialog=${RAW}`);
  });

  it('sends the archive to the dashboard and approvals to notifications', () => {
    renderAt('/mingo/archive', MingoArchivePage, false);
    expect(replace).toHaveBeenLastCalledWith('/dashboard');
    renderAt('/approvals', ApprovalsPage, false);
    expect(replace).toHaveBeenLastCalledWith('/notifications');
  });
});
