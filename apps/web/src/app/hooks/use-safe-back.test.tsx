import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stepsBackToPreviousPage, useSafeBack } from './use-safe-back';

const router = { back: vi.fn(), push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ORIGIN = 'http://localhost:3000';

/** Mount the hook and return its handler. */
function renderBack(fallback: string): () => void {
  let handler: () => void = () => {};
  function Probe() {
    handler = useSafeBack(fallback);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Probe />));
  return () => handler();
}

/** A Navigation API over `urls`, the last one current. */
function setHistory(urls: string[]) {
  const entries = urls.map((url, index) => ({ url: `${ORIGIN}${url}`, index }));
  (window as unknown as { navigation?: unknown }).navigation = {
    canGoBack: entries.length > 1,
    currentEntry: entries[entries.length - 1],
    entries: () => entries,
  };
}

describe('useSafeBack', () => {
  const go = vi.fn();

  beforeEach(() => {
    router.back.mockClear();
    router.push.mockClear();
    go.mockClear();
    window.history.go = go;
  });

  afterEach(() => {
    delete (window as unknown as { navigation?: unknown }).navigation;
  });

  it('a page with no pager goes back one step, as before', () => {
    setHistory(['/devices', '/devices/details?id=d1']);
    const back = renderBack('/devices');
    act(() => back());
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });

  it('skips the pages a table pushed on this page and leaves it', () => {
    setHistory([
      '/devices',
      '/devices/details?id=d1&tab=software',
      '/devices/details?id=d1&tab=software&swCursor=YQ&swPage=2',
      '/devices/details?id=d1&tab=software&swCursor=Yg&swPage=3',
    ]);
    expect(stepsBackToPreviousPage()).toBe(3);
    const back = renderBack('/devices');
    act(() => back());
    expect(go).toHaveBeenCalledWith(-3);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('stops at another entity on the same path', () => {
    setHistory(['/devices/details?id=d1', '/devices/details?id=d2', '/devices/details?id=d2&swCursor=YQ&swPage=2']);
    expect(stepsBackToPreviousPage()).toBe(2);
  });

  it('takes the fallback when every entry behind is this page (a shared link, then paging)', () => {
    setHistory(['/devices/details?id=d1&swCursor=YQ&swPage=2', '/devices/details?id=d1&swCursor=Yg&swPage=3']);
    const back = renderBack('/devices');
    act(() => back());
    expect(router.push).toHaveBeenCalledWith('/devices');
  });

  it('takes the fallback without the Navigation API', () => {
    const back = renderBack('/devices');
    act(() => back());
    expect(router.push).toHaveBeenCalledWith('/devices');
  });
});
