'use client';

import { ChatMessageListSkeleton } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface TicketDetailsSkeletonProps {
  onBack: () => void;
}

/**
 * Header actions. "Track Time" is omitted on purpose — it depends on the ticket's
 * status, which is exactly what's still loading.
 */
const SIDEBAR_ACTIONS: PageActionButton[] = [
  {
    label: 'Edit Ticket',
    ariaLabel: 'Edit Ticket',
    variant: 'outline',
    disabled: true,
    icon: <PenEditIcon className="text-ods-text-secondary" />,
    iconOnlyOnDesktop: true,
  },
];

/**
 * Loading skeleton shaped like the real ticket details page. Reusing the message
 * list's own `ChatMessageListSkeleton` keeps the transition seamless once the
 * dialog resolves but messages are still loading.
 *
 * `loading` on the `PageLayout` is what draws the title bar: the real header
 * always renders `dialog.title`, so omitting it left the `h1` line out entirely
 * and the whole page shifted up by one line while loading.
 */
export function TicketDetailsSkeleton({ onBack }: TicketDetailsSkeletonProps) {
  return (
    <PageLayout
      loading
      backButton={{ label: 'Back', onClick: onBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)] h-[calc(100%)]"
      actions={SIDEBAR_ACTIONS}
      actionsVariant="icon-buttons"
      contentClassName="flex flex-col min-h-0"
    >
      <SidebarLayoutSkeleton />
    </PageLayout>
  );
}

/** The chat pane the layout is built around, with the details column beside it. */
function MainChatPaneSkeleton() {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)] min-h-0">
      <Skeleton className="h-5 w-24" />
      <div className="flex-1 bg-ods-bg border border-ods-border rounded-md flex flex-col relative min-h-0">
        <ChatMessageListSkeleton fullWidth contentClassName="px-[var(--spacing-system-mf)]" />
      </div>
      <Skeleton className="mt-[var(--spacing-system-xsf)] h-12 w-full rounded-lg" />
    </div>
  );
}

/** A main pane beside a Ticket Details / Attachments / Tags sidebar. */
function SidebarLayoutSkeleton() {
  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-[var(--spacing-system-l)] min-h-0">
      {/* Main pane — chat is the most common case; transitions seamlessly into it */}
      <MainChatPaneSkeleton />

      {/* Right sidebar — desktop only, matching the loaded layout */}
      <aside className="hidden lg:flex shrink-0 lg:w-80 flex-col gap-[var(--spacing-system-l)] min-h-0">
        {/* Ticket Details info card */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Skeleton className="h-5 w-28" />
          <div className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={`info-${i}`} className="flex items-center gap-[var(--spacing-system-xsf)]">
                <Skeleton className="h-5 w-16 shrink-0" />
                <div className="flex-1 h-px bg-ods-border" />
                <Skeleton className="h-5 w-24 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Attachments */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Skeleton className="h-5 w-24" />
          <div className="rounded-md border border-ods-border overflow-hidden">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={`attachment-${i}`}
                className="flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] bg-ods-card border-b border-ods-border last:border-b-0"
              >
                <Skeleton className="size-10 rounded-md shrink-0" />
                <div className="flex-1 flex flex-col gap-[var(--spacing-system-xxs)] min-w-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-full rounded-md" />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Skeleton className="h-5 w-12" />
          <div className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-14 rounded-md" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </aside>
    </div>
  );
}
