/**
 * The shell's announcement bar (CU-17tkuw69v1p): a stored answer draws in the bar's first frame, the app is the
 * only fetcher (the lib bar never fetches), and every answer is stored for the next load's first paint.
 */

import type { Announcement } from '@flamingo-stack/openframe-frontend-core/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCEMENT_SEED_ATTRIBUTE, readStoredAnnouncement, storeAnnouncement } from '@/lib/announcement-cache';
import { AnnouncementBarSeed } from './announcement-bar-seed';
import { AnnouncementSlot } from './announcement-slot';
import { AnnouncementTopBar } from './announcement-top-bar';

const env = vi.hoisted(() => ({ fetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>() }));

vi.mock('@flamingo-stack/openframe-frontend-core/utils', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  embedAuthedFetch: env.fetch,
}));

const announcement = (overrides: Partial<Announcement> = {}): Announcement =>
  ({ id: 'a-1', title: 'Get the most out of OpenFrame', background_color: '#123456', ...overrides }) as Announcement;

const answer = (a: Announcement | null) =>
  new Response(JSON.stringify({ announcement: a }), { status: 200, headers: { 'Content-Type': 'application/json' } });

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let globalFetch: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  env.fetch.mockReset();
  globalFetch = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  client.clear();
  window.localStorage.clear();
  globalFetch.mockRestore();
});

const region = () => container.querySelector('[role="region"][aria-label="Announcement"]');
const flush = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));

function render(onExpandedChange?: (expanded: boolean) => void) {
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <AnnouncementTopBar onExpandedChange={onExpandedChange} />
      </QueryClientProvider>,
    ),
  );
}

describe('AnnouncementTopBar', () => {
  it('draws a stored announcement expanded in its first frame, before the hub answers', () => {
    storeAnnouncement(announcement(), 'web', Date.now() - 5 * 60_000);
    env.fetch.mockReturnValue(new Promise(() => {}));
    render();
    expect(region()?.getAttribute('aria-hidden')).toBe('false');
    expect(region()?.textContent).toContain('Get the most out of OpenFrame');
  });

  it('draws nothing until the first answer when nothing is stored, then the answer, and stores it', async () => {
    env.fetch.mockResolvedValue(answer(announcement()));
    render();
    expect(region()).toBeNull();
    await flush();
    expect(region()?.getAttribute('aria-hidden')).toBe('false');
    expect(readStoredAnnouncement()?.announcement?.id).toBe('a-1');
  });

  it('is the only fetcher: one request to the announcements URL, and none from the lib bar', async () => {
    env.fetch.mockResolvedValue(answer(announcement()));
    render();
    await flush();
    expect(env.fetch).toHaveBeenCalledTimes(1);
    expect(env.fetch.mock.calls[0]?.[0]).toMatch(/\/content\/api\/announcements\/active$/);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('does not ask again for an answer stored under a minute ago', async () => {
    storeAnnouncement(announcement(), 'web', Date.now() - 1000);
    render();
    await flush();
    expect(env.fetch).not.toHaveBeenCalled();
  });

  it('replaces a stored announcement the hub has turned off, and stores the empty answer', async () => {
    storeAnnouncement(announcement(), 'web', Date.now() - 5 * 60_000);
    env.fetch.mockResolvedValue(answer(null));
    render();
    expect(region()?.getAttribute('aria-hidden')).toBe('false');
    await flush();
    expect(region()?.getAttribute('aria-hidden')).toBe('true');
    const stored = readStoredAnnouncement();
    expect(stored).toBeDefined();
    expect(stored?.announcement).toBeNull();
  });

  it('keeps a stored announcement for another surface collapsed from the first frame', () => {
    storeAnnouncement(announcement({ surfaces: ['desktop'] }), 'web', Date.now() - 1000);
    render();
    expect(region()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps a dismissed stored announcement collapsed from the first frame', () => {
    document.cookie = 'openmsp-announcement-dismissed=a-1; path=/';
    storeAnnouncement(announcement(), 'web', Date.now() - 1000);
    render();
    expect(region()?.getAttribute('aria-hidden')).toBe('true');
    document.cookie = 'openmsp-announcement-dismissed=; path=/; max-age=0';
  });

  it('reports whether it shows, after its first commit', async () => {
    const reports: boolean[] = [];
    storeAnnouncement(announcement(), 'web', Date.now() - 1000);
    render(expanded => reports.push(expanded));
    await flush();
    expect(reports).toEqual([true]);
  });
});

describe('AnnouncementSlot', () => {
  let probeMounts = 0;
  function OtherBar() {
    useEffect(() => {
      probeMounts += 1;
    }, []);
    return <p data-other-bar="" />;
  }

  function renderSlot() {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <AnnouncementSlot whileHidden={<OtherBar />} />
        </QueryClientProvider>,
      ),
    );
  }

  beforeEach(() => {
    probeMounts = 0;
  });

  it('never mounts the other bar under a stored announcement, not even for its first commit', async () => {
    storeAnnouncement(announcement(), 'web', Date.now() - 1000);
    renderSlot();
    await flush();
    expect(region()?.getAttribute('aria-hidden')).toBe('false');
    expect(container.querySelector('[data-other-bar]')).toBeNull();
    expect(probeMounts).toBe(0);
  });

  it('gives the slot to the other bar once the announcement reports it shows nothing', async () => {
    env.fetch.mockResolvedValue(answer(null));
    renderSlot();
    await flush();
    expect(container.querySelector('[data-other-bar]')).not.toBeNull();
  });
});

describe('AnnouncementBarSeed', () => {
  it("draws the bar's strip in the stored background, hidden unless <html> carries the seed mark", () => {
    act(() => root.render(<AnnouncementBarSeed />));
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper.className).toContain('hidden');
    expect(wrapper.className).toContain(`[html[${ANNOUNCEMENT_SEED_ATTRIBUTE}]_&]:block`);
    const strip = wrapper.firstElementChild as HTMLElement;
    expect(strip.style.backgroundColor).toBe('var(--announcement-seed-bg)');
    expect(strip.textContent).toBe('');
  });
});
