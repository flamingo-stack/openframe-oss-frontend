'use client';

import { ChatContextChipStrip } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  BoxArchiveIcon,
  IdCardIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMingoContextEntityTypes } from '@/app/(app)/mingo/context/context-sources';
import { resolvePageContext } from '@/app/(app)/mingo/context/page-context';
import { useMingoContextStore } from '@/app/(app)/mingo/stores/mingo-context-store';
import { navModuleIcon, navModuleOf } from '@/lib/navigation-config';
import { routes } from '@/lib/routes';
import { canShowSheet, type ComposerRoute } from './mingo-dock-route';

/** What a click on the page's chip sends, in a new chat over the page. */
export const PAGE_OVERVIEW_PROMPT = 'Give me an overview of this page';

const ASK_HINT = 'Ask Mingo about this page';

/** Mingo's own pages have no sidebar module to take an icon from. */
const NAMED_PAGE_ICONS: Record<string, ReactNode> = {
  [routes.mingo.home]: <IdCardIcon />,
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

interface PageChipActions {
  /** Asks Mingo about the page (`PAGE_OVERVIEW_PROMPT` in a new chat). */
  onAsk: (prompt: string) => void;
  /** Opens the composer's context picker. */
  onAddContext: () => void;
}

/**
 * The page the composer sits on, at the start of its context strip: the page Mingo is
 * told about with every message (`currentPage`), named as it is told — "DEVICES",
 * "SETTINGS", and on an entity's page the entity the page shows ("CUSTOMER: DEFAULT",
 * the `openView` every message carries as `currentView`). A click asks Mingo for an
 * overview of the page. The entity's × takes it out of Mingo's context, as the memory
 * strip's dropdown does; the page itself is always sent, so its chip has none. Home
 * adds "+ Add context", the composer's picker. Not on the chat page: its messages are
 * about the page it was opened from, which is not on screen.
 */
export function usePageChip(route: ComposerRoute, { onAsk, onAddContext }: PageChipActions): ReactNode {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const openView = useMingoContextStore(s => s.openView);
  const removeView = useMingoContextStore(s => s.removeView);
  const entityTypes = useMingoContextEntityTypes();

  if (!canShowSheet(route) || pathname === null) return null;
  const ask = () => onAsk(PAGE_OVERVIEW_PROMPT);

  // A kind behind a module flag that is off is not one Mingo is offered: the page's own chip.
  const kind = openView ? entityTypes.find(type => type.type === openView.type) : undefined;
  if (openView && kind && route !== 'home') {
    return (
      <ChatContextChipStrip
        items={[{ type: openView.type, id: openView.id, label: `${kind.label}: ${openView.label}` }]}
        resolveIcon={() => kind.icon}
        onSelect={ask}
        selectHint={ASK_HINT}
        onRemove={() => removeView({ type: openView.type, id: openView.id })}
        className="min-w-0 shrink"
      />
    );
  }

  const href = search ? `${pathname}?${search}` : pathname;
  const { currentPage } = resolvePageContext(href, null);
  return (
    <>
      <ChatContextChipStrip
        items={[{ type: 'PAGE', id: pathname, label: currentPage.title }]}
        resolveIcon={() => pageIcon(pathname)}
        onSelect={ask}
        selectHint={ASK_HINT}
        className="min-w-0 shrink"
      />
      {route === 'home' && (
        <ChatContextChipStrip
          items={[{ type: 'ADD_CONTEXT', id: 'add-context', label: 'Add context' }]}
          resolveIcon={() => <PlusIcon />}
          onSelect={onAddContext}
          className="shrink-0"
        />
      )}
    </>
  );
}
