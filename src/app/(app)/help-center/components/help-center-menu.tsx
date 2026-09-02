'use client';

import {
  BookBookmarkIcon,
  CompassIcon,
  FileContentIcon,
  LifeBuoyIcon,
  QuestionCircleIcon,
  Rocket02Icon,
  RouteArrowIcon,
  ShieldCheckIcon,
  WrenchScrewdiverIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ComponentType } from 'react';
import { routes } from '@/lib/routes';
import { SettingMenuItem } from '../../settings/components/setting-menu-item';

type Item = {
  href: string;
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

const ITEMS: Item[] = [
  {
    href: routes.helpCenter.onboardingGuides,
    title: 'Onboarding Guides',
    description: 'Step-by-step product walkthroughs.',
    Icon: CompassIcon,
  },
  {
    href: routes.helpCenter.roadmap,
    title: 'Development Roadmap',
    description: "What we're building next.",
    Icon: RouteArrowIcon,
  },
  {
    href: routes.helpCenter.releases,
    title: 'Product Releases',
    description: 'Version history and release notes.',
    Icon: Rocket02Icon,
  },
  {
    href: routes.helpCenter.bugFixesAndEnhancements,
    title: 'Bug-fixes & Enhancements',
    description: 'Recently shipped fixes and improvements.',
    Icon: WrenchScrewdiverIcon,
  },
  {
    href: routes.helpCenter.tickets,
    title: 'Support Tickets',
    description: 'Open and manage your support tickets.',
    Icon: LifeBuoyIcon,
  },
  {
    href: routes.helpCenter.faqs,
    title: 'FAQs',
    description: 'Quick answers about OpenFrame and how we work.',
    Icon: QuestionCircleIcon,
  },
  {
    href: routes.helpCenter.legal('privacy'),
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your data.',
    Icon: ShieldCheckIcon,
  },
  {
    href: routes.helpCenter.legal('terms'),
    title: 'Terms of Service',
    description: 'License agreement and acceptable-use terms.',
    Icon: FileContentIcon,
  },
  {
    href: routes.helpCenter.knowledgeBase,
    title: 'Knowledge Base',
    description: 'Comprehensive guides and references for the OpenFrame platform.',
    Icon: BookBookmarkIcon,
  },
];

/**
 * The Help Center index grid. Entirely static, app-owned copy — no request
 * backs it, which is why the route's loading state renders this very component
 * rather than a placeholder: there is nothing to shimmer, and nothing shifts.
 */
export function HelpCenterMenu() {
  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2">
      {ITEMS.map(({ href, title, description, Icon }) => (
        <SettingMenuItem
          key={href}
          href={href}
          title={title}
          description={description}
          icon={<Icon className="size-6" />}
        />
      ))}
    </div>
  );
}
