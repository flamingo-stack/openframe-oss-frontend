'use client';

import { LoadingRegion, TextSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';
import { AUTH_ERROR_FALLBACK } from '../hooks/use-auth-error-message';
import { AuthStatusFrame } from './auth-status-frame';

/** The description while the auth server resolves it: two body lines in the paragraph's place. */
export function AuthErrorDescriptionSkeleton() {
  return (
    <LoadingRegion
      label="Loading the error details"
      className="flex w-[360px] max-w-full flex-col gap-[var(--spacing-system-xsf)]"
    >
      <TextSkeleton.Body />
      <TextSkeleton.Body className="w-3/4" />
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
