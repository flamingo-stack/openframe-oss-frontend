/**
 * Pins the remote desktop's fullscreen state and its exit: the state follows `fullscreenchange`, and leaving the
 * page while the document is fullscreen leaves fullscreen, so the next page is not stuck in it.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leaveDocumentFullscreen, useDocumentFullscreen } from './use-document-fullscreen';

let container: HTMLDivElement;
let root: Root;
let fullscreenElement: Element | null = null;
const exitFullscreen = vi.fn(() => Promise.resolve());

function Harness() {
  return <span>{useDocumentFullscreen() ? 'fullscreen' : 'windowed'}</span>;
}

function mount() {
  act(() => root.render(<Harness />));
}

function unmount() {
  act(() => root.unmount());
}

function enter(element: Element | null) {
  fullscreenElement = element;
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
}

beforeEach(() => {
  fullscreenElement = null;
  exitFullscreen.mockClear();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  container.remove();
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document, 'exitFullscreen');
});

describe('useDocumentFullscreen', () => {
  it('follows fullscreenchange', () => {
    mount();
    expect(container.textContent).toBe('windowed');
    enter(document.documentElement);
    expect(container.textContent).toBe('fullscreen');
    enter(null);
    expect(container.textContent).toBe('windowed');
    unmount();
  });

  it('leaves fullscreen when the page unmounts while the document is fullscreen', () => {
    mount();
    enter(document.documentElement);
    unmount();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('does nothing on unmount when the document is not fullscreen', () => {
    mount();
    unmount();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});

describe('leaveDocumentFullscreen', () => {
  afterEach(() => root.unmount());

  it("leaves another page's element fullscreen alone", () => {
    fullscreenElement = document.createElement('div');
    leaveDocumentFullscreen();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('swallows a refused exit (the document already left fullscreen)', async () => {
    fullscreenElement = document.documentElement;
    exitFullscreen.mockImplementationOnce(() => Promise.reject(new Error('Document not active')));
    expect(() => leaveDocumentFullscreen()).not.toThrow();
    await Promise.resolve();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
