'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { commitMutation, graphql, useFragment, useRelayEnvironment } from 'react-relay';
import { getRequest, type IEnvironment } from 'relay-runtime';
import type { useDraftBundle_bundle$key } from '@/__generated__/useDraftBundle_bundle.graphql';
import type { useDraftBundleCreateMutation as CreateMutationType } from '@/__generated__/useDraftBundleCreateMutation.graphql';
import type { useDraftBundleDeleteMutation as DeleteMutationType } from '@/__generated__/useDraftBundleDeleteMutation.graphql';
import { sendGraphqlKeepalive } from '@/lib/relay/environment';

/** An empty draft: no devices, no packages, no action — those arrive with submit. */
const createMutation = graphql`
  mutation useDraftBundleCreateMutation {
    createSoftwareBundle {
      id
      ...useDraftBundle_bundle
    }
  }
`;

/** Idempotent server-side: a draft already reaped answers true, a submitted one false. */
const deleteMutation = graphql`
  mutation useDraftBundleDeleteMutation($id: ID!) {
    deleteSoftwareBundle(id: $id)
  }
`;

/**
 * What the form reads off its draft while the user edits it: the size of the
 * assignment, which the picker's store updaters move on every +/−, so the
 * submit button follows the clicks without a query of its own.
 */
const bundleFragment = graphql`
  fragment useDraftBundle_bundle on SoftwareBundle {
    id
    deviceCount
  }
`;

function discard(environment: IEnvironment, id: string): void {
  commitMutation<DeleteMutationType>(environment, {
    mutation: deleteMutation,
    variables: { id },
    // Nothing to do either way: a draft that survives this is the reaper's.
    onCompleted: () => undefined,
    onError: () => undefined,
  });
}

/**
 * The bundle behind the Install / Update Software form, for as long as the page
 * is open.
 *
 * Opened with the form (once `enabled`), not on the first "+": the device picker
 * reads its lists off the bundle, so with a draft in hand from the start every
 * assignment — the first included — is the same in-place edit of the same
 * lists. Created on the first click instead, the picker had to start on the
 * fleet's list and swap to the bundle's mid-click, remounting every row. The
 * price is one create (and one discard) per visit. Every device the user adds
 * is written to the draft as it happens, the way a script schedule's assignment
 * is edited, so the selection never has to fit in the browser;
 * `submitSoftwareBundle` then runs or schedules whatever the draft holds.
 *
 * A draft that is NOT submitted is discarded with the page: on unmount for a
 * navigation within the app, and from `pagehide` for a tab close or reload,
 * where only a `keepalive` request can still go out. The browser guarantees
 * neither — a crash or a dropped network loses the request — so the server's
 * reaper of stale drafts stays the safety net, not this.
 */
export function useDraftBundle({ enabled }: { enabled: boolean }) {
  const environment = useRelayEnvironment();

  const [bundle, setBundle] = useState<useDraftBundle_bundle$key | null>(null);
  const [createError, setCreateError] = useState<Error | null>(null);
  const liveIdRef = useRef<string | null>(null);
  const creatingRef = useRef<Promise<string> | null>(null);
  const submittedRef = useRef(false);
  const goneRef = useRef(false);

  useEffect(() => {
    goneRef.current = false;
    return () => {
      goneRef.current = true;
      const id = liveIdRef.current;
      liveIdRef.current = null;
      if (id && !submittedRef.current) discard(environment, id);
    };
  }, [environment]);

  useEffect(() => {
    const onPageHide = () => {
      const id = liveIdRef.current;
      if (id && !submittedRef.current) sendGraphqlKeepalive(getRequest(deleteMutation).params, { id });
    };
    // Back from the back/forward cache: the draft went with the unload, so the
    // next assignment starts another rather than editing one that no longer
    // exists.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      liveIdRef.current = null;
      setBundle(null);
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  /**
   * The draft's id, creating the draft if there is none yet. Concurrent callers
   * — Strict Mode's double effect — share one creation. Rejects if the server refuses, or
   * if the page has left in the meantime (that draft is discarded here, since
   * nothing else knows it exists).
   */
  const ensureBundle = useCallback((): Promise<string> => {
    const live = liveIdRef.current;
    if (live) return Promise.resolve(live);
    if (creatingRef.current) return creatingRef.current;

    const creating = new Promise<string>((resolve, reject) => {
      commitMutation<CreateMutationType>(environment, {
        mutation: createMutation,
        variables: {},
        onCompleted: response => {
          const created = response.createSoftwareBundle;
          if (goneRef.current) {
            discard(environment, created.id);
            reject(new Error('The page was left before the selection could start'));
            return;
          }
          liveIdRef.current = created.id;
          setBundle(created);
          resolve(created.id);
        },
        onError: reject,
      });
    });
    creatingRef.current = creating.finally(() => {
      creatingRef.current = null;
    });
    return creatingRef.current;
  }, [environment]);

  // Open the draft as soon as the form may write — and again after a bfcache
  // restore dropped it (`pageshow` above) or a failed attempt was retried.
  const needsBundle = enabled && bundle === null && createError === null;
  useEffect(() => {
    if (!needsBundle) return;
    ensureBundle().catch((error: Error) => {
      if (!goneRef.current) setCreateError(error);
    });
  }, [needsBundle, ensureBundle]);

  /** Clears a failed creation, which makes the effect above try again. */
  const retryCreate = useCallback(() => setCreateError(null), []);

  /** Submit succeeded: the bundle is the run's history now, not a draft to discard. */
  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
  }, []);

  const draft = useFragment(bundleFragment, bundle);

  return {
    bundleId: draft?.id ?? null,
    deviceCount: draft?.deviceCount ?? 0,
    createError,
    retryCreate,
    markSubmitted,
  };
}
