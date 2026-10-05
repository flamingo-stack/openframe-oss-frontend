'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { useRouter } from 'next/navigation';
import { presentationFor } from '@/lib/exhaustive-map';
import { SOFTWARE_SECTIONS, type SoftwareSectionId } from './software-sections';

const SOFTWARE_TABS: TabItem[] = Object.entries(SOFTWARE_SECTIONS).map(([id, section]) => ({
  id,
  label: section.label,
  icon: section.icon,
}));

interface SoftwareTabNavigationProps {
  activeTab: SoftwareSectionId;
}

/**
 * Top-level switcher between the three Software pages. They are separate routes,
 * not `?tab=` views of one page, so this is pure navigation — no tab state and
 * no tab-owned components.
 */
export function SoftwareTabNavigation({ activeTab }: SoftwareTabNavigationProps) {
  const router = useRouter();

  const handleTabChange = (tabId: string) => {
    const href = presentationFor(SOFTWARE_SECTIONS, tabId)?.href;
    if (tabId !== activeTab && href) router.push(href);
  };

  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation urlSync={false} activeTab={activeTab} tabs={SOFTWARE_TABS} onTabChange={handleTabChange} />
    </div>
  );
}
