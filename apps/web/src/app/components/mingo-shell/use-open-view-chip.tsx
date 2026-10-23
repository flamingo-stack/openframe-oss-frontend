'use client';

import { ChatContextChipStrip } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { ReactNode } from 'react';
import { useMingoContextEntityTypes } from '@/app/(app)/mingo/context/context-sources';
import { useMingoContextStore } from '@/app/(app)/mingo/stores/mingo-context-store';
import { type ComposerRoute, isSheetRoute } from './mingo-dock-route';

/**
 * The entity the page shows, as a chip at the start of the composer's context strip
 * — "CUSTOMER: DEFAULT" on a customer's page. It is the `openView` every message
 * already carries as `currentView` (`useTrackOpenView` on the detail pages), so the
 * chip says only what Mingo is told. A list page tells Mingo nothing about itself,
 * so it shows none. Its × takes the entity out of Mingo's context, as the memory
 * strip's dropdown does. Not on home (a new chat about nothing yet) nor on the chat
 * page (no entity page is open there).
 */
export function useOpenViewChip(route: ComposerRoute): ReactNode {
  const openView = useMingoContextStore(s => s.openView);
  const removeView = useMingoContextStore(s => s.removeView);
  const entityTypes = useMingoContextEntityTypes();

  if (!openView || !isSheetRoute(route)) return null;
  const kind = entityTypes.find(type => type.type === openView.type);
  // A kind behind a module flag that is off: not one Mingo is offered here.
  if (!kind) return null;

  return (
    <ChatContextChipStrip
      items={[{ type: openView.type, id: openView.id, label: `${kind.label}: ${openView.label}` }]}
      resolveIcon={() => kind.icon}
      onRemove={() => removeView({ type: openView.type, id: openView.id })}
      className="min-w-0 shrink"
    />
  );
}
