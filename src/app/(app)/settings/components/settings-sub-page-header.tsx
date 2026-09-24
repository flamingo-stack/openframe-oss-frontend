'use client';

import { Arrow01LeftIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import { routes } from '@/lib/routes';

interface SettingsSubPageHeaderProps {
  title: string;
}

export function SettingsSubPageHeader({ title }: SettingsSubPageHeaderProps) {
  return (
    <div className="flex items-center gap-4 px-6 pt-6">
      <Link
        href={routes.settings.root()}
        className="flex size-10 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-card text-ods-text-secondary transition-colors hover:text-ods-text-primary"
      >
        <Arrow01LeftIcon className="size-5" />
      </Link>
      <h1 className="min-w-0 flex-1">
        {/* as="span": a heading may only contain phrasing content, and the default tooltip trigger is a div. */}
        <TruncateText as="span" variant="h2">
          {title}
        </TruncateText>
      </h1>
    </div>
  );
}
