'use client';

import {
  MspOrganizationCard,
  MspOrganizationCardSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { FlamingoLogo } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  ClockCheckIcon,
  SignalBroadcast02Icon,
  WrenchScrewdiverIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ComponentType } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { useTenantInfo } from '../../../hooks/use-tenant-info';

interface MeetFaePreviewProps {
  /** Assistant name woven into the copy and avatar — updates live as the user types. */
  assistantName: string;
  avatarUrl?: string;
  accentColor: string;
  mspName?: string;
  mspWebsite?: string;
  /** `thumbnail` scales the 600px source layout into a fixed-height card; `full` renders it 1:1. See `AiSettingsPreviews`. */
  variant?: 'thumbnail' | 'full';
}

interface FeatureRow {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function MeetFaePreview({
  assistantName,
  avatarUrl,
  accentColor,
  mspName = 'TechFlow Solutions',
  mspWebsite = 'www.techflow.com',
  variant = 'thumbnail',
}: MeetFaePreviewProps) {
  // Source the MSP org from the same tenant-info query the /settings card uses
  // (react-query-cached, so no extra request). Fall back to the sample copy/logo
  // so the preview still reads well before any org data is configured.
  const { data: tenantInfo, isLoading } = useTenantInfo();
  const orgName = tenantInfo?.name || mspName;
  const orgWebsite = tenantInfo?.website || mspWebsite;
  const orgLogoUrl =
    getFullImageUrl(tenantInfo?.image?.imageUrl, tenantInfo?.image?.hash) ??
    '/assets/ai-settings/chat-preview-logo.svg';

  const isThumbnail = variant === 'thumbnail';

  const features: FeatureRow[] = [
    {
      icon: WrenchScrewdiverIcon,
      title: 'Try to Fix It Instantly',
      description: `${assistantName} diagnoses common issues like email problems, password resets, slow performance, or connectivity — and resolves them on the spot.`,
    },
    {
      icon: SignalBroadcast02Icon,
      title: 'Escalate When Needed',
      description: `If the issue needs hands-on attention, ${assistantName} automatically creates a detailed support ticket so your technician knows exactly what's going on.`,
    },
    {
      icon: ClockCheckIcon,
      title: '24/7 — No Waiting',
      description:
        'Ask anything, anytime. No hold music, no queue — just immediate help or a fast handoff to the right person.',
    },
  ];

  const body = (
    <div
      className={cn(
        'flex flex-col p-[var(--spacing-system-l)]',
        // `min-h-full` (not `h-full`) so a viewport too short for the content
        // grows the box and scrolls from the top — `justify-center` inside a
        // scroll container clips its own overflow at the top otherwise.
        isThumbnail ? 'h-[945px] w-[600px] max-w-none origin-top-left' : 'min-h-full w-full',
      )}
      style={isThumbnail ? { transform: 'scale(var(--preview-scale))' } : undefined}
    >
      {/* 600px centered, matching the real welcome screen (openframe-chat
          `WelcomeScreen`). A no-op for the thumbnail, whose source box is
          already 600px wide before padding. */}
      <div className="mx-auto flex w-full max-w-ods-content-narrow flex-1 flex-col items-center justify-center gap-[var(--spacing-system-l)]">
        {/* Match the ChatHeader avatar, which fills its background with the
            accent (lib uses `bg-ods-flamingo-pink` = the re-pointed accent),
            so transparent areas of the avatar show the accent, not bg-ods-bg. */}
        <SquareAvatar
          src={avatarUrl}
          alt={assistantName}
          fallback={assistantName.charAt(0)}
          size="xl"
          variant="round"
          style={{ backgroundColor: accentColor }}
        />

        <p className="max-w-[504px] text-center text-ods-text-primary text-h3">
          Meet {assistantName}, your AI IT assistant. She fixes what she can right away — and hands off the rest to your
          technicians.
        </p>

        <div className="w-full overflow-hidden rounded-md border border-ods-border bg-ods-bg">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start gap-[var(--spacing-system-m)] border-b border-ods-border bg-ods-card p-[var(--spacing-system-m)] last:border-b-0"
            >
              <span
                // The 72px tile is a desktop-width figure; at phone width 1:1 it
                // eats a third of the row. Thumbnails only render at `md` and up,
                // so they keep the original size either way.
                className="flex size-12 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg md:size-[72px]"
                style={{ color: accentColor }}
              >
                <Icon className="size-6" />
              </span>
              <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
                <span className="text-ods-text-primary text-h3">{title}</span>
                {isThumbnail ? (
                  <TruncateText lines={2} variant="h6" tone="secondary">
                    {description}
                  </TruncateText>
                ) : (
                  // 1:1 wraps to ~4 lines at phone width; clamping to 2 here would
                  // hide copy the real welcome screen shows.
                  <span className="text-ods-text-secondary text-h6">{description}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <MspOrganizationCardSkeleton className="w-full" />
        ) : (
          <MspOrganizationCard
            name={orgName}
            website={orgWebsite}
            logoUrl={orgLogoUrl}
            onOpenWebsite={() => undefined}
            className="w-full"
          />
        )}

        <Button type="button" variant="accent" style={{ backgroundColor: accentColor }}>
          Get Started
        </Button>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-[var(--spacing-system-xs)] text-ods-text-secondary">
        <span className="text-h6">Powered by</span>
        <FlamingoLogo className="h-5 w-auto" fill="currentColor" />
        <span className="font-heading font-semibold text-h6">Flamingo</span>
      </div>
    </div>
  );

  if (!isThumbnail) return <div className="h-full w-full overflow-y-auto">{body}</div>;

  return (
    <div className="grid h-[250px] w-full place-items-center overflow-hidden rounded-md border border-ods-border bg-ods-bg [--preview-scale:0.264] md:h-[296px] md:[--preview-scale:0.313] lg:h-[380px] lg:[--preview-scale:0.402]">
      {/* 1:1 content in a 945px slot, transform-scaled (not zoom) to the per-breakpoint card
          height. zoom mis-renders text in Safari, so we scale via transform instead; the
          wrapper reserves the post-scale footprint so the card still centers the content. */}
      <div style={{ width: 'calc(600px * var(--preview-scale))', height: 'calc(945px * var(--preview-scale))' }}>
        {body}
      </div>
    </div>
  );
}
