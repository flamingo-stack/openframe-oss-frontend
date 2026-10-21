'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { AuthStatusFrame } from '../components/auth-status-frame';
import { AUTH_ERROR_REF } from '../constants/auth-error-codes';

export default function VerifyEmailPage() {
  return (
    // `useSearchParams` bails out to the client during the static prerender: the same screen stands in meanwhile.
    <LoadingSuspense label="Verifying your email" fallback={<VerifyEmailScreen />}>
      <VerifyEmailRedirect />
    </LoadingSuspense>
  );
}

/** The screen the visitor sees while they are sent on: the logo and a progress mark. */
function VerifyEmailScreen() {
  return (
    <AuthStatusFrame>
      <div className="flex size-6 items-center justify-center gap-[6px]">
        <span className="animate-[dotTravel_0.8s_cubic-bezier(0.4,0,0.2,1)_infinite] rounded-full bg-ods-text-primary" />
        <span className="animate-[dotTravel_0.8s_cubic-bezier(0.4,0,0.2,1)_0.27s_infinite] rounded-full bg-ods-text-primary" />
        <span className="animate-[dotTravel_0.8s_cubic-bezier(0.4,0,0.2,1)_0.54s_infinite] rounded-full bg-ods-text-primary" />
      </div>
    </AuthStatusFrame>
  );
}

function VerifyEmailRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!token) {
      // A code, not a sentence: the error page resolves it through the auth server, the same way it
      // resolves the server's own redirect when the token turns out to be invalid.
      router.replace(routes.auth.error({ ref: AUTH_ERROR_REF.VERIFICATION_LINK_INVALID }));
      return;
    }

    // `/sas/*` is a backend endpoint, never a Next page — this leaves the app on
    // purpose. Built through `new URL` rather than by concatenation so the
    // destination is provably absolute: with no shared host configured (the OSS
    // tenant, where the gateway serves `/sas/*` from this same origin) the base
    // falls back to the current origin, which is exactly what assigning the bare
    // path used to resolve to.
    const base = runtimeEnv.sharedHostUrl();
    const verifyUrl = new URL(
      `sas/email/verify?token=${encodeURIComponent(token)}`,
      `${(base || window.location.origin).replace(/\/*$/, '')}/`,
    );
    window.location.href = verifyUrl.toString();
  }, [token, router]);

  return <VerifyEmailScreen />;
}
