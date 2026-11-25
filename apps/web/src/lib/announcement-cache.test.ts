/** The hub announcement's last answer on the device, and the before-paint mark it feeds (CU-17tkuw69v1p). */

import type { Announcement } from '@flamingo-stack/openframe-frontend-core/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOUNCEMENT_SEED_ATTRIBUTE,
  ANNOUNCEMENT_SEED_BACKGROUND_VAR,
  ANNOUNCEMENT_STORAGE_KEY,
  ANNOUNCEMENT_STORE_TTL_MS,
  announcementSeedScript,
  readStoredAnnouncement,
  storeAnnouncement,
} from './announcement-cache';

const COOKIE = 'openmsp-announcement-dismissed';
const NOW = 1_800_000_000_000;

const announcement = (overrides: Partial<Announcement> = {}): Announcement =>
  ({ id: 'a-1', title: 'Get the most out of OpenFrame', background_color: '#123456', ...overrides }) as Announcement;

const html = document.documentElement;

afterEach(() => {
  window.localStorage.clear();
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
  html.removeAttribute(ANNOUNCEMENT_SEED_ATTRIBUTE);
  html.style.removeProperty(ANNOUNCEMENT_SEED_BACKGROUND_VAR);
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('readStoredAnnouncement / storeAnnouncement', () => {
  it('reads back what was stored while it is fresh', () => {
    storeAnnouncement(announcement(), 'web', NOW);
    expect(readStoredAnnouncement(NOW + 1000)?.announcement?.id).toBe('a-1');
  });

  it('keeps "the hub had none" apart from "nothing stored"', () => {
    expect(readStoredAnnouncement(NOW)).toBeUndefined();
    storeAnnouncement(null, 'web', NOW);
    const stored = readStoredAnnouncement(NOW);
    expect(stored).toBeDefined();
    expect(stored?.announcement).toBeNull();
  });

  it('ignores an answer older than the TTL, or from the future', () => {
    storeAnnouncement(announcement(), 'web', NOW);
    expect(readStoredAnnouncement(NOW + ANNOUNCEMENT_STORE_TTL_MS)).toBeUndefined();
    expect(readStoredAnnouncement(NOW - 1)).toBeUndefined();
  });

  it('ignores a broken or unknown entry', () => {
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, 'not json');
    expect(readStoredAnnouncement(NOW)).toBeUndefined();
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify({ v: 2, announcement: null, storedAt: NOW }));
    expect(readStoredAnnouncement(NOW)).toBeUndefined();
  });

  it('survives blocked storage', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeAnnouncement(announcement(), 'web', NOW)).not.toThrow();
    expect(readStoredAnnouncement(NOW)).toBeUndefined();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('announcementSeedScript', () => {
  function seed(): boolean {
    // The script is ours, built from constants: what runs in `<head>` runs here.
    new Function(announcementSeedScript())();
    return html.hasAttribute(ANNOUNCEMENT_SEED_ATTRIBUTE);
  }

  const storeFresh = (a: Announcement | null, surface: 'web' | 'desktop' | 'mobile' = 'web') => {
    vi.useFakeTimers({ now: NOW });
    storeAnnouncement(a, surface, NOW - 1000);
  };

  it('marks <html> and hands the bar its background for a fresh stored announcement', () => {
    storeFresh(announcement());
    expect(seed()).toBe(true);
    expect(html.style.getPropertyValue(ANNOUNCEMENT_SEED_BACKGROUND_VAR)).toBe('#123456');
  });

  it('marks nothing when nothing, none, or a stale answer is stored', () => {
    expect(seed()).toBe(false);
    storeFresh(null);
    expect(seed()).toBe(false);
    vi.useFakeTimers({ now: NOW });
    storeAnnouncement(announcement(), 'web', NOW - ANNOUNCEMENT_STORE_TTL_MS);
    expect(seed()).toBe(false);
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, 'not json');
    expect(seed()).toBe(false);
  });

  it('marks nothing for an announcement limited to another surface', () => {
    storeFresh(announcement({ surfaces: ['desktop'] }), 'web');
    expect(seed()).toBe(false);
    storeFresh(announcement({ surfaces: ['desktop'] }), 'desktop');
    expect(seed()).toBe(true);
  });

  it('marks nothing under one of its excluded paths, with or without the trailing slash', () => {
    storeFresh(announcement({ excluded_paths: ['/mingo'] }));
    window.history.replaceState(null, '', '/mingo/');
    expect(seed()).toBe(false);
    window.history.replaceState(null, '', '/devices/');
    expect(seed()).toBe(true);
  });

  it('skips a pattern that is not a valid expression instead of failing', () => {
    storeFresh(announcement({ excluded_paths: ['(', '/other'] }));
    window.history.replaceState(null, '', '/mingo/');
    expect(seed()).toBe(true);
  });

  it('marks nothing for a dismissed announcement, and still marks after another one was dismissed', () => {
    storeFresh(announcement());
    document.cookie = `${COOKIE}=a-1; path=/`;
    expect(seed()).toBe(false);
    document.cookie = `${COOKIE}=a-0; path=/`;
    expect(seed()).toBe(true);
  });

  it('honours the legacy per-id dismissal when there is no cookie', () => {
    storeFresh(announcement());
    window.localStorage.setItem('openmsp-announcement-a-1-dismissed', 'true');
    expect(seed()).toBe(false);
  });
});
