/**
 * The onboarding call banner is optional: it keeps no place while anything about it is
 * unanswered, and appears whole once its reads answer.
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoIntroBanner } from './mingo-intro-banner';

const { reads } = vi.hoisted(() => ({
  reads: { linkLoading: false, videoLoading: false, link: true as boolean, video: false as boolean },
}));

vi.mock('@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link', () => ({
  useOnboardingMeetingLink: () => ({
    link: reads.link ? { url: 'https://example.com/book' } : null,
    isLoading: reads.linkLoading,
  }),
}));
vi.mock('@/app/hooks/use-walkthrough-video-data', () => ({
  useWalkthroughVideoData: () => ({
    video: reads.video ? { mainVideoUrl: 'https://example.com/clip.mp4' } : null,
    isLoading: reads.videoLoading,
  }),
}));
vi.mock('@/app/(app)/onboarding/components/book-call/book-call-walkthrough-video', () => ({
  BookCallWalkthroughVideo: () => <div data-testid="clip" />,
}));
vi.mock('@/app/(app)/setup/components/book-call-modal', () => ({ BookCallModal: () => null }));

let container: HTMLDivElement;
let root: Root;

const banner = () => container.querySelector('section');
const bookButton = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Book a Call');

beforeEach(() => {
  Object.assign(reads, { linkLoading: false, videoLoading: false, link: true, video: false });
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
  it('books a call once its reads answer, marked optional', () => {
    act(() => root.render(<MingoIntroBanner />));
    expect(banner()?.hasAttribute('data-loading-optional')).toBe(true);
    expect(bookButton()?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="clip"]')).toBeNull();
  });

  it('draws nothing in the page’s loading state', () => {
    act(() =>
      root.render(
        <LoadingScope>
          <MingoIntroBanner />
        </LoadingScope>,
      ),
    );
    expect(banner()).toBeNull();
  });

  it('draws nothing while the call or the clip is still read, then appears whole', () => {
    reads.video = true;
    reads.videoLoading = true;
    act(() => root.render(<MingoIntroBanner />));
    expect(banner()).toBeNull();

    reads.videoLoading = false;
    reads.linkLoading = true;
    act(() => root.render(<MingoIntroBanner />));
    expect(banner()).toBeNull();

    reads.linkLoading = false;
    act(() => root.render(<MingoIntroBanner key="answered" />));
    expect(container.querySelector('[data-testid="clip"]')).not.toBeNull();
    expect(bookButton()?.disabled).toBe(false);
  });

  it('is gone with nothing to offer, and once closed', () => {
    reads.link = false;
    act(() => root.render(<MingoIntroBanner />));
    expect(banner()).toBeNull();

    reads.link = true;
    act(() => root.render(<MingoIntroBanner key="offer" />));
    const dismiss = container.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
    act(() => dismiss?.click());
    expect(banner()).toBeNull();
  });
});
