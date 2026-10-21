'use client';

import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';
import { AUTH_ERROR_FALLBACK } from '../hooks/use-auth-error-message';
import { AuthStatusFrame } from './auth-status-frame';

/** The description while the auth server resolves it: two lines of the paragraph's own type step, at its width. */
function AuthErrorDescriptionSkeleton() {
  return (
    <LoadingRegion label="Loading the error details" className="w-full">
      <TextLineSkeleton type="h4" lines={2} className="w-full" />
    </LoadingRegion>
  );
}

/** The resolved description; until it is in (or in a loading scope) its skeleton. */
export function AuthErrorDescription({ text }: { text?: string }) {
  const loading = useLoadingScope() || text === undefined;
  if (loading) return <AuthErrorDescriptionSkeleton />;
  return <p className="text-ods-text-secondary text-h4">{text}</p>;
}

/**
 * Where every auth failure lands: the static title and the two ways out, around the description the auth server
 * answered for the URL's `ref` (`description` undefined while it is being resolved).
 */
export function AuthErrorScreen({ description }: { description?: string }) {
  const router = useRouter();

  return (
    <AuthStatusFrame>
      <div className="flex max-w-[600px] flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-ods-text-primary text-h2">{AUTH_ERROR_FALLBACK.title}</h1>
          <AuthErrorDescription text={description} />
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => window.open('https://www.flamingo.run/contact', '_blank', 'noopener,noreferrer')}
          >
            Contact Support
          </Button>
          <Button variant="accent" onClick={() => router.push(routes.auth.root)}>
            Go to Login
          </Button>
        </div>
      </div>
    </AuthStatusFrame>
  );
}
