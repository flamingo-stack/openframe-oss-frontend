'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
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
 * There is none until the user assigns a device: `ensureBundle` creates the
 * draft on the first "+" / "Add All" and answers every later call with the same
 * id, so a page that is opened and left again costs the server nothing. From
 * then on every device the user adds is written to it as it happens, the way a
 * script schedule's assignment is edited, so the selection never has to fit in
 * the browser; `submitSoftwareBundle` then runs or schedules whatever the draft
 * holds.
 *
 * A draft that is NOT submitted is discarded with the page: on unmount for a
 * navigation within the app, and from `pagehide` for a tab close or reload,
 * where only a `keepalive` request can still go out. The browser guarantees
 * neither — a crash or a dropped network loses the request — so the server's
 * reaper of stale drafts stays the safety net, not this.
 */
export function useDraftBundle() {
  const environment = useRelayEnvironment();

  const [bundle, setBundle] = useState<useDraftBundle_bundle$key | null>(null);
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
   * — two quick clicks — share one creation. Rejects if the server refuses, or
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
          // A transition: the lists that hang off the bundle then load under the
          // fleet lists already on screen, instead of dropping them to a skeleton
          // on the very click that added the first device.
          startTransition(() => setBundle(created));
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

  /** Submit succeeded: the bundle is the run's history now, not a draft to discard. */
  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
  }, []);

  const draft = useFragment(bundleFragment, bundle);

  return {
    bundleId: draft?.id ?? null,
    deviceCount: draft?.deviceCount ?? 0,
    ensureBundle,
    markSubmitted,
  };
}
