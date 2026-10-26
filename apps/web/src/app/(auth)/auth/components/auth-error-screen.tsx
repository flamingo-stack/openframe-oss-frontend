'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { routes } from '@/lib/routes';
import { AUTH_ERROR_FALLBACK } from '../hooks/use-auth-error-message';
import { AuthStatusFrame } from './auth-status-frame';

/**
 * Where every auth failure lands: the static title and the two ways out render at once, around the description the
 * auth server answers for the URL's `ref` (`AuthErrorDescription`, the one part that waits).
 */
export function AuthErrorScreen({ description }: { description: ReactNode }) {
  const router = useRouter();

  return (
    <AuthStatusFrame>
      <div className="flex max-w-[600px] flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-ods-text-primary text-h2">{AUTH_ERROR_FALLBACK.title}</h1>
          {description}
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

/** The description the auth server answered (`text` undefined while it is being resolved). */
export function AuthErrorDescription({ text }: { text?: string }) {
  return <LoadingParagraph text={text} label="Loading the error details" />;
}
