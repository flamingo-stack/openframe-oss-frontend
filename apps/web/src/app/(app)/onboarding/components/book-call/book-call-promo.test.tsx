/**
 * The promo holds the scheduler's height only while there is a video to fill it, or one may still land.
 * Settled with none, it fits its copy: held, the space was an empty block under the CTA (CU-17tkuw6a7wz).
 */

import { MEETING_SCHEDULER_H } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookCallPromo } from './book-call-promo';

const { read } = vi.hoisted(() => ({
  read: { isLoading: false, video: null as null | { mainVideoUrl?: string; youtubeUrl?: string } },
}));

vi.mock('@/app/hooks/use-walkthrough-video-data', () => ({
  useWalkthroughVideoData: () => read,
}));
vi.mock('./book-call-walkthrough-video', () => ({ BookCallWalkthroughVideo: () => null }));

let container: HTMLDivElement;
let root: Root;

/** Every class of the scheduler height is on the card. */
const holdsSchedulerHeight = () => {
  const classes = container.querySelector('section')?.classList;
  return MEETING_SCHEDULER_H.split(' ').every(token => classes?.contains(token));
};

beforeEach(() => {
  Object.assign(read, { isLoading: false, video: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('BookCallPromo', () => {
  it('fits its copy once the read settles with no video', () => {
    act(() => root.render(<BookCallPromo onBookCall={() => undefined} />));
    expect(holdsSchedulerHeight()).toBe(false);
  });

  it('fits its copy when the video has no playable source', () => {
    read.video = {};
    act(() => root.render(<BookCallPromo onBookCall={() => undefined} />));
    expect(holdsSchedulerHeight()).toBe(false);
  });

  it('holds the scheduler height while the read is in flight', () => {
    read.isLoading = true;
    act(() => root.render(<BookCallPromo onBookCall={() => undefined} />));
    expect(holdsSchedulerHeight()).toBe(true);
  });

  it.each([{ mainVideoUrl: 'https://example.com/clip.mp4' }, { youtubeUrl: 'https://youtu.be/x' }])(
    'holds the scheduler height with a video (%o)',
    video => {
      read.video = video;
      act(() => root.render(<BookCallPromo onBookCall={() => undefined} />));
      expect(holdsSchedulerHeight()).toBe(true);
    },
  );
});
