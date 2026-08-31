'use client';

import {
  CalendarDaysIcon,
  Chevron02RightIcon,
  LayersMinusIcon,
  LifeBuoyIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentType } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { routes } from '@/lib/routes';
import type { CancelReason } from './cancel-subscription-modal';

interface OfferPreset {
  title: string;
  description: string;
  ctaTitle: string;
  ctaDescription: string;
  ctaIcon: ComponentType<{ className?: string }>;
  ctaHref?: string;
}

const OFFER_PRESETS: Record<CancelReason, OfferPreset> = {
  TOO_EXPENSIVE: {
    title: 'Compare Plans',
    description: `You don't have to lose everything you've built. A smaller plan keeps your workspace intact. Devices, scripts, monitoring, and history at a lower cost.`,
    ctaTitle: 'Find a Plan that Fits',
    ctaDescription: `Keep everything you've built at a lower cost.`,
    ctaIcon: LayersMinusIcon,
    // No href: the plan picker is a modal on the page this opens from, so the
    // caller handles it (`onCtaClick`) rather than navigating anywhere.
  },
  NOT_USING_ENOUGH: {
    title: 'Compare Plans',
    description: `You don't have to lose everything you've built. A smaller plan keeps your workspace intact. Devices, scripts, monitoring, and history at a lower cost.`,
    ctaTitle: 'Find a Plan that Fits',
    ctaDescription: `Keep everything you've built at a lower cost.`,
    ctaIcon: LayersMinusIcon,
    // No href: the plan picker is a modal on the page this opens from, so the
    // caller handles it (`onCtaClick`) rather than navigating anywhere.
  },
  MISSING_FEATURE: {
    title: 'Check the Roadmap',
    description: `We're actively building out OpenFrame. Take a look at what's coming, if what you need is on the roadmap, we'd love to keep you around for it.`,
    ctaTitle: `See what's Coming`,
    ctaDescription: 'What you need might already be in progress.',
    ctaIcon: CalendarDaysIcon,
    ctaHref: routes.helpCenter.roadmap,
  },
  TECHNICAL_ISSUES: {
    title: 'Contact Support',
    description: `If something isn't working the way it should, our team can help. Most issues get resolved faster than a full migration.`,
    ctaTitle: 'We can Help',
    ctaDescription: 'Most issues get resolved faster than switching tools.',
    ctaIcon: LifeBuoyIcon,
    ctaHref: routes.helpCenter.tickets,
  },
  OTHER: {
    title: 'Contact Support',
    description: `If something isn't working the way it should, our team can help. Most issues get resolved faster than a full migration.`,
    ctaTitle: 'We can Help',
    ctaDescription: 'Most issues get resolved faster than switching tools.',
    ctaIcon: LifeBuoyIcon,
    ctaHref: routes.helpCenter.tickets,
  },
};

interface CancelOfferModalProps {
  isOpen: boolean;
  reason: CancelReason | null;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCtaClick?: () => void;
}

export function CancelOfferModal({
  isOpen,
  reason,
  isPending = false,
  onClose,
  onConfirm,
  onCtaClick,
}: CancelOfferModalProps) {
  if (!reason) return null;

  const preset = OFFER_PRESETS[reason];
  const CtaIcon = preset.ctaIcon;

  // An href is a destination and always wins; a preset without one is asking the
  // page to do something in place.
  //
  // The destinations are this tenant's OWN help center, reached through the route
  // registry, and that is the fix for the bug they had: they used to point at
  // `openframe.ai/roadmap` and a `mailto:`, so a customer mid-cancellation landed
  // on the marketing site's login wall instead of the roadmap that was supposed to
  // talk them out of leaving.
  //
  // Still a new tab, deliberately: the retention prompt is an aside, and navigating
  // in place would close this modal and abandon a cancellation the user has not
  // finished deciding about.
  const handleCtaClick = () => {
    if (preset.ctaHref) {
      window.open(preset.ctaHref, '_blank', 'noopener,noreferrer');
      return;
    }
    onCtaClick?.();
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title={preset.title}
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Keep Subscription
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isPending} loading={isPending}>
            Cancel Subscription
          </Button>
        </>
      }
    >
      <p className="text-h4 text-ods-text-primary">{preset.description}</p>

      <button
        type="button"
        onClick={handleCtaClick}
        className="flex items-center gap-[var(--spacing-system-s)] h-20 px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg hover:bg-ods-card transition-colors text-left w-full"
      >
        <div className="flex items-center justify-center size-12 rounded-sm border border-ods-border bg-ods-bg shrink-0">
          <CtaIcon className="size-6 text-ods-text-primary" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-h3 font-bold text-ods-text-primary">{preset.ctaTitle}</span>
          <span className="text-h6 text-ods-text-secondary">{preset.ctaDescription}</span>
        </div>
        <div className="flex items-center justify-center p-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card shrink-0">
          <Chevron02RightIcon className="size-6 text-ods-text-primary" />
        </div>
      </button>
    </SimpleModal>
  );
}
