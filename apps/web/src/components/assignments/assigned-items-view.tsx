'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { type TabItem, TabNavigation, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { CustomersAssignedTable } from './tables/customers-assigned-table';
import { DevicesAssignedTable } from './tables/devices-assigned-table';
import { KnowledgeBaseAssignedTable } from './tables/knowledge-base-assigned-table';
import { TicketsAssignedTable } from './tables/tickets-assigned-table';
import { TARGET_CONFIG } from './target-config';
import { ASSIGNMENT_TARGET_TYPES, type AssignmentItemType, type ServerAssignmentTargetType } from './types';
import { useAssignedItems } from './use-assigned-items';

export interface AssignedItemsViewProps {
  itemId: string;
  itemType: AssignmentItemType;
  className?: string;
  /** Render the built-in "Assigned Items" heading. Hosts that supply their own
   *  section title (e.g. the ticket details page) pass `false`. */
  showTitle?: boolean;
}

/**
 * The kind of assignment an item usually carries, drawn while its assignments are read and before it is known
 * which kinds it has, and when it has none (its table's empty state): an incident's tickets, a ticket's devices,
 * an article's customers.
 */
const TYPICAL_TARGET_TYPE: Record<AssignmentItemType, ServerAssignmentTargetType> = {
  INSIGHT: 'TICKET',
  TICKET: 'DEVICE',
  KNOWLEDGE_ARTICLE: 'ORGANIZATION',
};

export function AssignedItemsView({ itemId, itemType, className, showTitle = true }: AssignedItemsViewProps) {
  const inScope = useLoadingScope();
  const assigned = useAssignedItems({ itemId, itemType, enabled: !inScope });
  const { value, customers, devices, articles, tickets, loadingTypes } = assigned;
  const isLoading = inScope || assigned.isLoading;

  const activeTypes = useMemo(() => ASSIGNMENT_TARGET_TYPES.filter(type => (value[type]?.length ?? 0) > 0), [value]);

  const [pinnedTab, setPinnedTab] = useState<ServerAssignmentTargetType | null>(null);
  const activeTab = pinnedTab && activeTypes.includes(pinnedTab) ? pinnedTab : activeTypes[0];

  const tabs: TabItem[] = useMemo(
    () =>
      activeTypes.map(type => ({
        id: type,
        label: TARGET_CONFIG[type].tabLabel,
        icon: TARGET_CONFIG[type].icon as TabItem['icon'],
      })),
    [activeTypes],
  );

  // Nothing is known yet: the section with the item's typical kind of assignment, its table drawing its own rows.
  const pending = isLoading && activeTypes.length === 0;
  /** A kind is drawn loading only while its own read is on its way (or while no kind is known yet). */
  const kindLoading = (type: ServerAssignmentTargetType) => pending || inScope || !!loadingTypes[type];

  const renderTabBody = (type: ServerAssignmentTargetType) => {
    switch (type) {
      case 'ORGANIZATION':
        return <CustomersAssignedTable customers={customers ?? []} isLoading={kindLoading(type)} />;
      case 'DEVICE':
        return <DevicesAssignedTable devices={devices ?? []} isLoading={kindLoading(type)} />;
      case 'KNOWLEDGE_ARTICLE':
        return <KnowledgeBaseAssignedTable articles={articles ?? []} isLoading={kindLoading(type)} />;
      case 'TICKET':
        return <TicketsAssignedTable tickets={tickets ?? []} isLoading={kindLoading(type)} />;
      default: {
        // `type` is `never` here because the cases above cover ServerAssignmentTargetType.
        // Adding a member to that union makes this assignment fail to compile, which
        // is the point — a silent `undefined` tab body would just render nothing.
        const unreachable: never = type;
        return unreachable;
      }
    }
  };

  // With no assignments (or none known yet) the section keeps its frame over the item's typical kind, whose table
  // draws its own loading or empty state: nothing vanishes when the read answers empty.
  // While nothing is read the view is the typical item: assignments of ONE kind, so no tab bar. An item whose
  // assignments span several kinds gains the tab bar above its rows once read; that is the accepted cost of drawing
  // the common case (the kinds are only known from the read).
  const shownTypes = activeTypes.length === 0 ? [TYPICAL_TARGET_TYPE[itemType]] : activeTypes;

  const body = (
    <>
      {showTitle && <h3 className="mb-[var(--spacing-system-lf)] text-ods-text-primary text-h2">Assigned Items</h3>}

      <div className="overflow-hidden rounded-md border border-ods-border">
        {shownTypes.length === 1 ? (
          <div className="p-[var(--spacing-system-mf)]">{renderTabBody(shownTypes[0])}</div>
        ) : (
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={id => setPinnedTab(id as ServerAssignmentTargetType)}
          >
            {active => (
              <div className="p-[var(--spacing-system-mf)]">{renderTabBody(active as ServerAssignmentTargetType)}</div>
            )}
          </TabNavigation>
        )}
      </div>
    </>
  );

  return pending ? (
    <LoadingRegion as="section" label="Loading assigned items" className={className}>
      {body}
    </LoadingRegion>
  ) : (
    <section className={className}>{body}</section>
  );
}
