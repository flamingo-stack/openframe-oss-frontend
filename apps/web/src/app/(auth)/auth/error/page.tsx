'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useSearchParams } from 'next/navigation';
import { AuthErrorScreen } from '../components/auth-error-screen';
import { useAuthErrorMessage } from '../hooks/use-auth-error-message';

/**
 * Where every auth failure lands. The URL carries one thing, `ref`, and the page shows only what the
 * auth server answers for it (`useAuthErrorMessage`): a catalog sentence, a message the server stored
 * for this attempt, or its generic entry. No query parameter is ever rendered - the page used to print
 * `?error=<text>` as the message, which let anyone put their own words under our logo.
 */
export default function AuthErrorPage() {
  return (
    // `useSearchParams` bails out to the client during the static prerender: the screen itself, in a loading scope,
    // stands in until the URL is read.
    <LoadingSuspense label="Loading the error details" fallback={<AuthErrorScreen />}>
      <AuthErrorFromUrl />
    </LoadingSuspense>
  );
}

function AuthErrorFromUrl() {
  const searchParams = useSearchParams();
  const { description, isLoading } = useAuthErrorMessage(searchParams.get('ref'));

  return <AuthErrorScreen description={isLoading ? undefined : description} />;
}
