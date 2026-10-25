'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
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
  return (
    <AuthErrorScreen
      description={
        // `useSearchParams` bails out to the client during the static prerender: only the description waits for the
        // URL (the screen's title and its ways out render at once), and announces itself.
        <LoadingSuspense status={false} fallback={<AuthErrorDescription />}>
          <AuthErrorFromUrl />
        </LoadingSuspense>
      }
    />
  );
}

function AuthErrorFromUrl() {
  const searchParams = useSearchParams();
  const { description, isLoading } = useAuthErrorMessage(searchParams.get('ref'));

  return <AuthErrorDescription text={isLoading ? undefined : description} />;
}
