'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSearchParams } from 'next/navigation';
import { AuthErrorDescription, AuthErrorScreen } from '../components/auth-error-screen';
import { useAuthErrorMessage } from '../hooks/use-auth-error-message';

/**
 * Where every auth failure lands. The URL carries one thing, `ref`, and the page shows only what the
 * auth server answers for it (`useAuthErrorMessage`): a catalog sentence, a message the server stored
 * for this attempt, or its generic entry. No query parameter is ever rendered - the page used to print
 * `?error=<text>` as the message, which let anyone put their own words under our logo.
 */
export default function AuthErrorPage() {
  return <AuthErrorScreen description={<AuthErrorFromUrl />} />;
}

/**
 * The description, with its own boundary: `useSearchParams` bails out to the client during the static prerender, so
 * only the description waits for the URL (the screen's title and its ways out render at once), and announces itself.
 */
function AuthErrorFromUrl() {
  return (
    <LoadingSuspense status={false}>
      <AuthErrorFromUrlReader />
    </LoadingSuspense>
  );
}

function AuthErrorFromUrlReader() {
  // In a loading scope (its boundary's fallback): the description's own loading form, and no URL read.
  if (useLoadingScope()) return <AuthErrorDescription />;
  return <AuthErrorFromUrlLive />;
}

function AuthErrorFromUrlLive() {
  const searchParams = useSearchParams();
  const { description, isLoading } = useAuthErrorMessage(searchParams.get('ref'));

  return <AuthErrorDescription text={isLoading ? undefined : description} />;
}
