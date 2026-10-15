'use client';

import { useLegalDocuments } from '@flamingo-stack/openframe-frontend-core/components';
import {
  BookBookmarkIcon,
  CompassIcon,
  FileContentIcon,
  LifeBuoyIcon,
  QuestionCircleIcon,
  Rocket02Icon,
  RouteArrowIcon,
  ShieldLockIcon,
  WrenchScrewdiverIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TRUST_CENTER_TITLE } from '@flamingo-stack/openframe-frontend-core/types';
import { isLegalDocumentType } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ComponentType } from 'react';
import { routes } from '@/lib/routes';
import { SettingMenuItem } from '../../settings/components/setting-menu-item';
import { EP } from '../endpoints';

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
    href: routes.helpCenter.trustCenter,
    title: TRUST_CENTER_TITLE,
    description: 'Security, compliance and AI governance, continuously monitored.',
    Icon: ShieldLockIcon,
  },
  {
    href: routes.helpCenter.knowledgeBase,
    title: 'Knowledge Base',
    description: 'Comprehensive guides and references for the OpenFrame platform.',
    Icon: BookBookmarkIcon,
  },
];

/**
 * The Help Center index grid. Its own items are static, app-owned copy, which
 * is why the route's loading state renders this very component rather than a
 * placeholder. The legal documents are the one read: one card per document on
 * the hub's list (`EP.legalDocuments`), each opening that document's own
 * page. They come last, so the static cards never move when they arrive, and a
 * document the hub publishes later appears with no change here.
 */
export function HelpCenterMenu() {
  const { documents } = useLegalDocuments({ apiEndpoint: EP.legalDocuments });
  // A card for every document on the hub's list that this app has a page for
  // (the route prerenders the lib's `LEGAL_DOCUMENT_TYPES`).
  const legal = documents.flatMap(doc => (isLegalDocumentType(doc.docType) ? [{ ...doc, docType: doc.docType }] : []));
  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] content-md:grid-cols-2">
      {ITEMS.map(({ href, title, description, Icon }) => (
        <SettingMenuItem
          key={href}
          href={href}
          title={title}
          description={description}
          icon={<Icon className="size-6" />}
        />
      ))}
      {legal.map(doc => (
        <SettingMenuItem
          key={doc.docType}
          href={routes.helpCenter.legal(doc.docType)}
          title={doc.title}
          description={doc.summary}
          icon={<FileContentIcon className="size-6" />}
        />
      ))}
    </div>
  );
}
