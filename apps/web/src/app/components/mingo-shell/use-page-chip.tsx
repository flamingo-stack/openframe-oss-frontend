'use client';

import {
  BoxArchiveIcon,
  ShieldCheckIcon,
  XmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMingoContextEntityTypes } from '@/app/(app)/mingo/context/context-sources';
import { isMingoHomeHref, pageContextHref, resolvePageContext } from '@/app/(app)/mingo/context/page-context';
import { useMingoContextStore } from '@/app/(app)/mingo/stores/mingo-context-store';
import { useIsMobileViewport } from '@/app/hooks/use-is-mobile-viewport';
import { navModuleIcon, navModuleOf } from '@/lib/navigation-config';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';
import { useMingoSheetStore } from './mingo-sheet-store';

/** What a click on the page's chip sends, in a new chat over the page. */
export const PAGE_OVERVIEW_PROMPT = 'Give me an overview of this page';

const ASK_HINT = 'Ask Mingo about this page';

/** Mingo's own pages have no sidebar module to take an icon from. */
const NAMED_PAGE_ICONS: Record<string, ReactNode> = {
  [routes.mingo.archive]: <BoxArchiveIcon />,
  [routes.approvals]: <ShieldCheckIcon />,
};

function pageIcon(pathname: string): ReactNode {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path in NAMED_PAGE_ICONS) return NAMED_PAGE_ICONS[path];
  const navModule = navModuleOf(path);
  if (!navModule) return null;
  const Icon = navModuleIcon(navModule);
  return <Icon />;
}

/** A chip's name, cut short in the strip; its tooltip holds the whole of it. */
function ChipLabel({ children }: { children: string }) {
  return <span className="max-w-[220px] truncate">{children}</span>;
}

/**
 * The page the composer's messages are about, at the start of its context strip, drawn as
 * the "Continue …" chip beside it is: the page Mingo is told about with every message
 * (`currentPage`), named as it is told — "Devices", "Settings", and on an entity's page
 * the entity the page shows ("Customer: Default", the `openView` every message carries
 * as `currentView`). A click asks Mingo for an overview of the page. The entity's × takes
 * it out of Mingo's context, as the memory strip's dropdown does; the page itself is
 * always sent, so its chip has none. `onAsk` sends `PAGE_OVERVIEW_PROMPT` in a new chat.
 *
 * Mingo's home and the chat page are no page of their own: their chip is the page their
 * messages are about (`pageContextHref`), the one the chat was opened from — on a phone,
 * the page a new chat was started over — and none when that is the home, a new chat
 * with no page (a desktop's home always is).
 */
export function usePageChip(route: ComposerRoute, onAsk: (prompt: string) => void): ReactNode {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const openView = useMingoContextStore(s => s.openView);
  const removeView = useMingoContextStore(s => s.removeView);
  const entityTypes = useMingoContextEntityTypes();
  const lastPage = useMingoSheetStore(s => s.lastPage);
  const newChatPage = useMingoSheetStore(s => s.newChatPage);
  const phone = useIsMobileViewport() === true;

  if (pathname === null) return null;
  const ask = () => onAsk(PAGE_OVERVIEW_PROMPT);

  if (route === 'home' || route === 'chat') {
    const location = { pathname, search: search ? `?${search}` : '' };
    const href = pageContextHref(location, lastPage, phone ? { newChatPage } : undefined);
    return isMingoHomeHref(href) ? null : <PageChip href={href} onAsk={ask} />;
  }

  // A kind behind a module flag that is off is not one Mingo is offered: the page's own chip.
  const kind = openView ? entityTypes.find(type => type.type === openView.type) : undefined;
  if (openView && kind) {
    const label = `${kind.label}: ${openView.label}`;
    return (
      <div role="group" aria-label={`Context ${label}`} className="flex shrink-0">
        <Button
          variant="outline"
          size="compact"
          attach="start"
          leftIcon={kind.icon}
          onClick={ask}
          title={`${ASK_HINT}: ${label}`}
          aria-label={`${ASK_HINT}: ${label}`}
        >
          <ChipLabel>{label}</ChipLabel>
        </Button>
        <Button
          variant="outline"
          size="compact"
          attach="end"
          onClick={() => removeView({ type: openView.type, id: openView.id })}
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
          className="shrink-0 px-[var(--spacing-system-xsf)]"
        >
          <XmarkIcon />
        </Button>
      </div>
    );
  }

  return <PageChip href={search ? `${pathname}?${search}` : pathname} onAsk={ask} />;
}

/** A page's chip, named and marked as Mingo is told about it (`href` with its query). */
function PageChip({ href, onAsk }: { href: string; onAsk: () => void }) {
  const { currentPage } = resolvePageContext(href, null);
  return (
    <Button
      variant="outline"
      size="compact"
      leftIcon={pageIcon(href.split('?')[0])}
      onClick={onAsk}
      title={`${ASK_HINT}: ${currentPage.title}`}
      aria-label={`${ASK_HINT}: ${currentPage.title}`}
      className="shrink-0"
    >
      <ChipLabel>{currentPage.title}</ChipLabel>
    </Button>
  );
}
