'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter, useSearchParams } from 'next/navigation';

const DEFAULT_ERROR = {
  title: 'Oops, Something Went Wrong',
  description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const errorCode = searchParams.get('error') || '';
  const { title, description } = {
    title: DEFAULT_ERROR.title,
    description: errorCode || DEFAULT_ERROR.description,
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ods-bg p-10">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      {/* Error Content */}
      <div className="flex max-w-[600px] flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-ods-text-primary text-h2">{title}</h1>
          <p className="text-ods-text-secondary text-h4">{description}</p>
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => window.open('https://www.flamingo.run/contact', '_blank', 'noopener,noreferrer')}
          >
            Contact Support
          </Button>
          <Button variant="accent" onClick={() => router.push('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>

      {/* Footer */}
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
