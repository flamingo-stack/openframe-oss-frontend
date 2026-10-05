'use client';

import { scrollElementIntoView } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Breathing room between the top of the scroll container and the anchored row.
 * Replaces the accordion row's former `scroll-mt-20` (80px), which only the
 * native `scrollIntoView` honored — `scrollElementIntoView` takes the offset
 * explicitly instead of reading `scroll-margin-top`. Exported so the page's
 * `navigateSamePageHash` calls aim their tween at the same landing position.
 */
export const ANCHOR_TOP_OFFSET_PX = 80;

/**
 * Marks a row's collapsible body wrapper (set in `onboarding-accordion.tsx`).
 * The click anchor measures the previously open row's body through it to
 * pre-subtract the height that is about to collapse away — same trick as the
 * hub's `ticket-drawer-` lookup in the core-lib `TicketRow`.
 */
const STEP_BODY_SELECTOR = '[data-onboarding-step-body]';

interface AccordionOptions<T extends string> {
  /**
   * URL-synced open step (the hub same-page anchor model — `#faq-…`/`#delivery-…`
   * there, `#step-…` here). The page parses + validates the hash fragment and
   * passes it in; the hook reports every open/close through `onOpenStepChange`
   * so the hash always mirrors the open block, and adopts external hash changes
   * (back/forward, edited URL) by opening + anchoring that step. Omit both on
   * surfaces without URL state (the dashboard card).
   */
  urlStep?: T | null;
  /** Reports the open step on every change — `null` means "all collapsed". */
  onOpenStepChange?: (step: T | null) => void;
}

/**
 * Single-open accordion for an onboarding surface. Every step starts collapsed
 * and only the user opens one: a chevron click, or a deep link (`urlStep`),
 * which is anchored into view on mount. Progress never moves the open step —
 * the guided auto-advance this replaced opened the next step and scrolled to
 * it on its own, which pulled the page out from under the user.
 *
 * A click anchors the clicked row (open, close, or cross-row switch, exactly
 * like the hub's `TicketRow`) and mirrors the change into the URL. Anchoring
 * goes through the core-lib's unified `scrollElementIntoView` helper — it
 * resolves the actual scroll container (the AppLayout `<main overflow-y-auto>`,
 * not the window), survives layout shifts from the still-animating accordion,
 * and honors `prefers-reduced-motion` internally.
 *
 * Returns per-step accessors meant for `OnboardingAccordionItem`:
 * `expandedOf`/`onExpandedChangeOf` (controlled expansion) and `refOf` (anchor node).
 */
export function useOnboardingAccordion<T extends string>({
  urlStep = null,
  onOpenStepChange,
}: AccordionOptions<T> = {}) {
  const [openStep, setOpenStepState] = useState<T | null>(urlStep);
  const nodesRef = useRef(new Map<T, HTMLDivElement>());
  // Stable per-step ref callbacks, so rows don't detach/re-attach on every render.
  const refCallbacksRef = useRef(new Map<T, (node: HTMLDivElement | null) => void>());
  const prevUrlStepRef = useRef(urlStep);
  const openStepRef = useRef(openStep);
  const onOpenStepChangeRef = useRef(onOpenStepChange);
  useEffect(() => {
    openStepRef.current = openStep;
    onOpenStepChangeRef.current = onOpenStepChange;
  });

  // Every internal transition goes through here so the URL param stays a
  // faithful mirror of the open block.
  const setOpenStep = useCallback((step: T | null) => {
    setOpenStepState(step);
    onOpenStepChangeRef.current?.(step);
  }, []);

  const scrollToStep = useCallback((step: T) => {
    const node = nodesRef.current.get(step);
    if (!node) return;
    scrollElementIntoView(node, { headerOffset: ANCHOR_TOP_OFFSET_PX });
  }, []);

  // Click anchor — fires immediately on toggle (no animation wait): the tween
  // recomputes its target every frame, and `adjustTargetY` pre-subtracts the
  // still-collapsing body of the previously open row when it sits ABOVE the
  // clicked one, so the scroll aims at the FINAL post-collapse position from
  // frame one. Same math as the hub's `TicketRow` cross-row switch.
  const scrollToToggledStep = useCallback((step: T, collapsingStep: T | null) => {
    const node = nodesRef.current.get(step);
    if (!node) return;
    const collapsingNode = collapsingStep && collapsingStep !== step ? nodesRef.current.get(collapsingStep) : null;
    scrollElementIntoView(node, {
      headerOffset: ANCHOR_TOP_OFFSET_PX,
      adjustTargetY: raw => {
        const body = collapsingNode?.querySelector(STEP_BODY_SELECTOR);
        if (!(body instanceof HTMLElement)) return raw;
        const bodyRect = body.getBoundingClientRect();
        // A collapsing body BELOW the clicked row doesn't shift its resting
        // position — only subtract when it's above. Re-measured per frame, the
        // remaining height converges to 0 as the collapse finishes.
        if (bodyRect.bottom > node.getBoundingClientRect().top) return raw;
        return raw - bodyRect.height;
      },
    });
  }, []);

  // Mount: a deep-linked step opens collapsed-siblings-first and is landed on.
  // Read from a ref so the effect stays mount-only: re-running it on a later
  // URL change would re-scroll the page, which the adopt effect below owns.
  const scrollToStepRef = useRef(scrollToStep);
  useEffect(() => {
    scrollToStepRef.current = scrollToStep;
  });
  useEffect(() => {
    const initial = openStepRef.current;
    if (initial) scrollToStepRef.current(initial);
  }, []);

  // Adopt external URL changes (back/forward, hand-edited param): the URL owns
  // the open drawer, so follow it and anchor the newly opened row. Our own
  // writes echo back with `urlStep === openStep` and fall through.
  useEffect(() => {
    if (urlStep === prevUrlStepRef.current) return;
    prevUrlStepRef.current = urlStep;
    if (urlStep === openStepRef.current) return;
    const collapsing = openStepRef.current;
    setOpenStepState(urlStep);
    if (urlStep) scrollToToggledStep(urlStep, collapsing);
  }, [urlStep, scrollToToggledStep]);

  const expandedOf = useCallback((step: T) => step === openStep, [openStep]);

  const onExpandedChangeOf = useCallback(
    (step: T) => (value: boolean) => {
      const collapsing = openStepRef.current;
      setOpenStep(value ? step : null);
      // Every click anchors the clicked row — open, close, or switch.
      scrollToToggledStep(step, value ? collapsing : null);
    },
    [setOpenStep, scrollToToggledStep],
  );

  const refOf = useCallback((step: T) => {
    let callback = refCallbacksRef.current.get(step);
    if (!callback) {
      callback = node => {
        if (node) nodesRef.current.set(step, node);
        else nodesRef.current.delete(step);
      };
      refCallbacksRef.current.set(step, callback);
    }
    return callback;
  }, []);

  return { expandedOf, onExpandedChangeOf, refOf };
}
