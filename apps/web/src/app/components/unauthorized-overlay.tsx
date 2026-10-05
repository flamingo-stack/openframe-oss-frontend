'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { isAppShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';

interface UnauthorizedOverlayProps {
  onRetry?: () => void;
}

export function UnauthorizedOverlay({ onRetry }: UnauthorizedOverlayProps) {
  const router = useRouter();
  const loginUrl = runtimeEnv.authLoginUrl();

  const handleLogin = () => {
    if (isAppShell()) {
      // Auth pages are enabled in the native shell — full sign-in flow
      // (email → tenant discovery → provider selection → system-browser OAuth).
      // replace, not push: don't stack the auth screens on top of the app route,
      // so back after login lands on real content, never the login page.
      router.replace(routes.auth.root);
      return;
    }
    if (loginUrl) {
      // Land on the Login tab directly — the auth host's root defaults to Sign Up.
      // The auth host is a different origin, so this is deliberately a full
      // navigation and not a router push; `new URL` keeps it provably absolute.
      window.location.href = new URL('auth/login/', `${loginUrl.replace(/\/*$/, '')}/`).toString();
    } else {
      // Fallback: reload or no-op
      if (onRetry) onRetry();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ods-bg p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-ods-text-primary text-h2">Sign in required</h1>
        <p className="text-ods-text-secondary">You need to sign in to access this page.</p>
        <div className="flex justify-center">
          <Button onClick={handleLogin}>Sign in</Button>
        </div>
      </div>
    </div>
  );
}
