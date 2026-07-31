'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { routes } from '@/lib/routes';

interface SettingsSubPageHeaderProps {
  title: string;
}

export function SettingsSubPageHeader({ title }: SettingsSubPageHeaderProps) {
  return (
    <div className="flex items-center gap-4 pt-6 px-6">
      <Link
        href={routes.settings.root()}
        className="shrink-0 size-10 rounded-md bg-ods-card border border-ods-border flex items-center justify-center text-ods-text-secondary hover:text-ods-text-primary transition-colors"
      >
        <ArrowLeft className="size-5" />
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
