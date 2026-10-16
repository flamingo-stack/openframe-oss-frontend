/**
 * The routes that exist in one app mode resolve themselves in the other: a SaaS
 * tenant's home is Mingo's (the dashboard and the tour forward to it), and an OSS
 * tenant has no Mingo (its pages forward to the dashboard, approvals to notifications).
 * App mode is synchronous, so nothing waits and nothing draws a loader.
 */

import type { ComponentType } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toGlobalId } from '@/lib/relay-id';
import ApprovalsPage from './approvals/page';
import Dashboard from './dashboard/page';
import MingoArchivePage from './mingo/archive/page';
import MingoChatPage from './mingo/chat/page';
import MingoHomePage from './mingo/page';
import OnboardingPage from './onboarding/page';

const { replace, mode } = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
  mode: { saas: true },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => mode.saas,
}));
vi.mock('@/app/(app)/dashboard/components/dashboard-content', () => ({ default: () => <p>dashboard</p> }));
vi.mock('@/app/(app)/onboarding/components/onboarding-content', () => ({ OnboardingContent: () => <p>tour</p> }));
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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, '', '/');
});

function renderAt(url: string, Page: ComponentType, saas: boolean) {
  mode.saas = saas;
  window.history.replaceState(null, '', url);
  act(() => root.render(<Page />));
}

describe('a SaaS tenant', () => {
  it('renders the Mingo pages', () => {
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

  it('forwards the dashboard to Mingo home, query and fragment kept, drawing nothing', () => {
    renderAt('/dashboard?mingoDialog=d-1#top', Dashboard, true);
    expect(container.textContent).toBe('');
    expect(replace).toHaveBeenCalledWith('/mingo?mingoDialog=d-1#top');
  });

  it('forwards the tour to Mingo home', () => {
    renderAt('/onboarding', OnboardingPage, true);
    expect(container.textContent).toBe('');
    expect(replace).toHaveBeenCalledWith('/mingo');
  });

  it('swaps a Relay global chat id in the URL for the raw one', () => {
    renderAt(`/mingo/chat?id=${toGlobalId('Dialog', RAW)}`, MingoChatPage, true);
    expect(container.textContent).toBe('');
    expect(replace).toHaveBeenCalledWith(`/mingo/chat?id=${RAW}`);
  });

  it('sends a chat link without an id to Mingo home', () => {
    renderAt('/mingo/chat', MingoChatPage, true);
    expect(replace).toHaveBeenCalledWith('/mingo');
  });
});

describe('an OSS tenant', () => {
  it('renders the dashboard and the tour', () => {
    renderAt('/dashboard', Dashboard, false);
    expect(container.textContent).toBe('dashboard');
    renderAt('/onboarding', OnboardingPage, false);
    expect(container.textContent).toBe('tour');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends the Mingo pages to the dashboard and approvals to notifications', () => {
    renderAt('/mingo', MingoHomePage, false);
    expect(replace).toHaveBeenLastCalledWith('/dashboard');
    renderAt(`/mingo/chat?id=${RAW}`, MingoChatPage, false);
    expect(replace).toHaveBeenLastCalledWith('/dashboard');
    renderAt('/mingo/archive', MingoArchivePage, false);
    expect(replace).toHaveBeenLastCalledWith('/dashboard');
    renderAt('/approvals', ApprovalsPage, false);
    expect(replace).toHaveBeenLastCalledWith('/notifications');
    expect(container.textContent).toBe('');
  });
});
