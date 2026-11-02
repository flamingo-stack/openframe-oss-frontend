'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import {
  type DesktopAuthReturn,
  landingLocation,
  launchDesktopApp,
  readDesktopAuthReturn,
} from '@/lib/desktop-auth-return';
import { appWordedMessage, MOBILE_AUTH_ERROR } from '@/lib/mobile-auth-return';
import { SsoJoinCardLayout } from '../components/sso-join-card-layout';
import { useAuthErrorMessage } from '../hooks/use-auth-error-message';

const DESKTOP_APP_NAME = 'OpenFrame Console';

/** Read once per page load: the effect strips the URL right after, and the hand-off has to outlive that for the button. */
let captured: DesktopAuthReturn | null = null;

/** The URL is read once and never watched, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): DesktopAuthReturn {
  captured ??= readDesktopAuthReturn(landingLocation(window.location, performance.getEntriesByType('navigation')[0]));
  return captured;
}

/** Prerendered HTML has no URL to read: render the empty frame, then the real state on hydration. */
function getServerSnapshot(): null {
  return null;
}

interface Outcome {
  title: string;
  body: string;
  /** Why it failed, under the body: the auth server's sentence for a reference, or the app's own. */
  reason: { serverRef: string } | { text: string } | null;
  /** A failure with a code, which an administrator can be handed. */
  failureCode: string | null;
}

const FAILURE_BODY = `We couldn’t sign you in. Return to ${DESKTOP_APP_NAME} to try again, or sign in with a different account. You can close this tab.`;

function outcomeFor(handoff: DesktopAuthReturn): Outcome {
  if (handoff.kind === 'signed-in') {
    return {
      title: 'You’re signed in',
      body: `Return to ${DESKTOP_APP_NAME} to continue. You can close this tab.`,
      reason: null,
      failureCode: null,
    };
  }
  if (handoff.kind === 'signup') {
    // The provider is not in the hand-off, so the account is not named by it.
    return {
      title: 'One more step',
      body: `This account isn’t linked to an OpenFrame account yet. Return to ${DESKTOP_APP_NAME} to finish setting it up. You can close this tab.`,
      reason: null,
      failureCode: null,
    };
  }
  if (handoff.kind === 'error' && handoff.code === MOBILE_AUTH_ERROR.USER_CANCELED) {
    return {
      title: 'Sign-in canceled',
      body: `You can close this tab and return to ${DESKTOP_APP_NAME}.`,
      reason: null,
      failureCode: null,
    };
  }
  if (handoff.kind === 'error') {
    const appWorded = appWordedMessage(handoff.code);
    return {
      title: 'Login failed',
      body: FAILURE_BODY,
      reason: appWorded ? { text: appWorded } : { serverRef: handoff.code },
      failureCode: handoff.code,
    };
  }
  if (handoff.kind === 'incomplete') {
    return {
      title: 'Sign-in didn’t finish',
      body: `Return to ${DESKTOP_APP_NAME} and try again. You can close this tab.`,
      reason: null,
      failureCode: null,
    };
  }
  return {
    title: 'Nothing to finish here',
    body: `This page completes a sign-in started from the ${DESKTOP_APP_NAME} app.`,
    reason: null,
    failureCode: null,
  };
}

/**
 * Where a desktop sign-in ends in the browser (see `lib/desktop-auth-return.ts`). Shows the outcome,
 * takes the ticket out of the address bar, and launches the app's scheme once. Every landing from the
 * gateway launches, a cancel or an empty one included: the app is waiting on it and would otherwise
 * sit out its timeout. The button is for a browser that blocked the launch or a prompt the user
 * dismissed. The shell cannot tell attempts apart, so a tab left over from an earlier attempt resolves
 * whichever sign-in is waiting with its own result - a ticket that is still good when the user
 * canceled and retried within its lifetime.
 */
export default function DesktopReturnPage() {
  const handoff = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const outcome = handoff ? outcomeFor(handoff) : null;
  const serverRef = outcome?.reason && 'serverRef' in outcome.reason ? outcome.reason.serverRef : null;
  const serverError = useAuthErrorMessage(serverRef);
  const { copy } = useCopyToClipboard({
    successTitle: 'Details copied',
    successDescription: 'Paste them to your administrator.',
    errorTitle: 'Couldn’t copy',
    errorDescription: 'Your browser blocked the clipboard.',
  });
  const launched = useRef(false);

  useEffect(() => {
    if (!handoff || handoff.kind === 'none' || launched.current) return;
    launched.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    launchDesktopApp(handoff.appUrl);
  }, [handoff]);

  if (!handoff || !outcome) {
    return <SsoJoinCardLayout>{null}</SsoJoinCardLayout>;
  }

  const reasonLoading = serverError.isLoading;
  const reasonText =
    !outcome.reason || reasonLoading
      ? undefined
      : 'text' in outcome.reason
        ? outcome.reason.text
        : serverError.description;
  const { failureCode } = outcome;

  const copyDetails = () =>
    copy(
      [
        `${DESKTOP_APP_NAME} sign-in failed`,
        `Code: ${failureCode}`,
        `Reason: ${reasonText}`,
        `Time: ${new Date().toISOString()}`,
      ].join('\n'),
    );

  return (
    <SsoJoinCardLayout>
      <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <h1 className="text-ods-text-primary text-h2">{outcome.title}</h1>
          <p className="text-ods-text-secondary text-h4">{outcome.body}</p>
        </div>
        {outcome.reason && (
          <div className="rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]">
            <LoadingParagraph text={reasonText} label="Loading the error details" type="h6" />
          </div>
        )}
        {handoff.kind !== 'none' && (
          <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
            <Button type="button" variant="outline" fullWidth onClick={() => launchDesktopApp(handoff.appUrl)}>
              Open {DESKTOP_APP_NAME}
            </Button>
            {failureCode && !reasonLoading && (
              <Button type="button" variant="transparent" fullWidth onClick={() => void copyDetails()}>
                Copy details
              </Button>
            )}
            <p className="text-center text-ods-text-tertiary text-h6">
              If your browser asks, allow it to open {DESKTOP_APP_NAME}.
            </p>
          </div>
        )}
      </div>
    </SsoJoinCardLayout>
  );
}
