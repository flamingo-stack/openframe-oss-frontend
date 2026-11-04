/**
 * `useCopyToClipboard` shows `copied` for a while and resets it on a timer. The timer must not outlive
 * the component: a reset landing after the unmount is a state update on a component that is gone,
 * which React resolves through `window` - and once a test file has ended, there is no window left.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyToClipboard } from './use-copy-to-clipboard';

const toast = vi.hoisted(() => vi.fn());

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast }) }));

function CopyProbe() {
  const { copy, copied } = useCopyToClipboard({ resetDelay: 2000 });
  return (
    <button type="button" onClick={() => void copy('text')}>
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  container = document.createElement('div');
  root = createRoot(container);
  toast.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

const mount = () => act(async () => root.render(<CopyProbe />));
const click = () => act(async () => container.querySelector('button')?.click());

describe('useCopyToClipboard', () => {
  it('shows copied until the reset delay has passed', async () => {
    await mount();

    await click();

    expect(writeText).toHaveBeenCalledWith('text');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(container.textContent).toBe('copied');
    act(() => vi.advanceTimersByTime(1999));
    expect(container.textContent).toBe('copied');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).toBe('copy');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts the delay from the last copy', async () => {
    await mount();
    await click();
    act(() => vi.advanceTimersByTime(1500));

    await click();
    act(() => vi.advanceTimersByTime(1500));

    expect(container.textContent).toBe('copied');
    act(() => vi.advanceTimersByTime(500));
    expect(container.textContent).toBe('copy');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the reset timer on unmount', async () => {
    await mount();
    await click();
    expect(vi.getTimerCount()).toBe(1);

    act(() => root.unmount());

    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(2000));
  });

  it('schedules no reset for a copy the clipboard answers after the unmount', async () => {
    let land: () => void = () => {};
    writeText.mockReturnValue(
      new Promise<void>(resolve => {
        land = resolve;
      }),
    );
    await mount();
    await click();
    act(() => root.unmount());

    await act(async () => land());

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(vi.getTimerCount()).toBe(0);
  });
});
