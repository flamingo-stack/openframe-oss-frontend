'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { runtimeEnv } from '@/lib/runtime-config';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!token) {
      router.replace(`/auth/error?error=${encodeURIComponent('Invalid verification link. Please try again.')}`);
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ods-bg p-10">
      <div className="flex items-center gap-2">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      <div className="flex size-6 items-center justify-center gap-[6px]">
        <span className="animate-[dotTravel_0.8s_cubic-bezier(0.4,0,0.2,1)_infinite] rounded-full bg-ods-text-primary" />
        <span className="animate-[dotTravel_0.8s_cubic-bezier(0.4,0,0.2,1)_0.27s_infinite] rounded-full bg-ods-text-primary" />
        <span className="animate-[dotTravel_0.8s_cubic-bezier(0.4,0,0.2,1)_0.54s_infinite] rounded-full bg-ods-text-primary" />
        <style>{`
          @keyframes dotTravel {
            0%, 100% { width: 2px; height: 2px; opacity: 0.4; }
            50% { width: 4px; height: 4px; opacity: 0.9; }
          }
        `}</style>
      </div>

      <a
        href="https://flamingo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md bg-transparent p-4 text-ods-text-secondary transition-colors hover:bg-ods-bg-hover"
      >
        <span className="text-h6">Powered by</span>
        <FlamingoLogo className="h-5 w-5" fill="currentColor" />
        <span className="font-semibold text-code">Flamingo</span>
      </a>
    </div>
  );
}
