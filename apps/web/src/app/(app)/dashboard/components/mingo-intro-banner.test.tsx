/**
 * The onboarding call banner while whether it shows is not known yet: the place is kept,
 * and "Book a Call" stays locked until the banner is really there.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoIntroBanner } from './mingo-intro-banner';

vi.mock('@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link', () => ({
  useOnboardingMeetingLink: () => ({ link: { url: 'https://example.com/book' }, isLoading: false }),
}));
vi.mock('@/app/hooks/use-walkthrough-video-data', () => ({
  useWalkthroughVideoData: () => ({ video: null, isLoading: false }),
}));
vi.mock('@/app/(app)/onboarding/components/book-call/book-call-walkthrough-video', () => ({
  BookCallWalkthroughVideo: () => <div data-testid="clip" />,
}));
vi.mock('@/app/(app)/setup/components/book-call-modal', () => ({ BookCallModal: () => null }));

let container: HTMLDivElement;
let root: Root;

const bookButton = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Book a Call');

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoIntroBanner', () => {
  it('books a call once it is there', () => {
    act(() => root.render(<MingoIntroBanner />));
    expect(bookButton()?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="clip"]')).toBeNull();
  });

  it('keeps the place of the clip and the button, locked, while it loads', () => {
    act(() => root.render(<MingoIntroBanner loading />));
    expect(bookButton()?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="clip"]')).not.toBeNull();
  });
});
