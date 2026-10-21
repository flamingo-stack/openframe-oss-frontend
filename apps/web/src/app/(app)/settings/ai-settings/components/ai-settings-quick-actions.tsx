'use client';

import {
  getAgentAccent,
  type QuickActionAccent,
  renderQuickActionIcon,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  IconTile,
  type Row,
  StackedRowsPanel,
  LoadingWhen,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useMemo } from 'react';
import { NO_ITEMS } from '@/app/components/shared';
import type { AiQuickAction } from '../types/ai-settings';

/** Per-tab wording for the quick-actions blocks (Mingo vs the customer assistant). */
export interface QuickActionsAgentConfig {
  /** Woven into the list header: "OpenFrame {agentLabel} Quick Actions". */
  agentLabel: string;
  /** Core-lib agent slug: checkbox ids, and the fallback glyph accent (`getAgentAccent`). */
  agentSlug: string;
}

/**
 * Glyph tint for an agent's quick actions, resolved the way the chat chips
 * do it: an explicit `accent` (the customer assistant's configured accent
 * color) wins, else the built-in agent accent (Mingo cyan, Fae pink).
 */
export function resolveQuickActionAccent(
  agentConfig: QuickActionsAgentConfig,
  accent?: QuickActionAccent,
): QuickActionAccent | undefined {
  return accent || getAgentAccent(agentConfig.agentSlug);
}

export const MINGO_QUICK_ACTIONS_CONFIG: QuickActionsAgentConfig = { agentLabel: 'Mingo', agentSlug: 'mingo' };
export const ASSISTANT_QUICK_ACTIONS_CONFIG: QuickActionsAgentConfig = { agentLabel: 'AI Assistant', agentSlug: 'fae' };

/** Overrides the source banner's two text lines (title + caption). */
export interface QuickActionsBannerCopy {
  value: string;
  label: string;
}

/**
 * Info banner above the list: whose actions are in effect (view mode).
 * A single-row lib StackedRowsPanel; `leadingIcon` centers the 24px glyph
 * against both text lines per the mock (matches the lib's InfoBanner story).
 * `copy` overrides the default OpenFrame-vs-org wording — the per-customer view
 * uses it because there "default" means "inherited from the global config".
 */
export function QuickActionsSourceBanner({ isDefault, copy }: { isDefault?: boolean; copy?: QuickActionsBannerCopy }) {
  // Whose actions are in effect is read: while loading, the same row (its padding and its icon), its two cells null,
  // which the panel draws as bars of their own type steps in the scope.
  const loading = useLoadingScope() || isDefault == null;
  return (
    <LoadingWhen loading={isDefault == null}>
      <StackedRowsPanel
        rows={[
          {
            id: 'source',
            className: 'p-[var(--spacing-system-s)]',
            columns: [
              {
                key: 'source',
                leadingIcon: <InfoCircleIcon className="size-6 text-ods-text-secondary" />,
                value: loading
                  ? null
                  : (copy?.value ?? (isDefault ? 'Using OpenFrame default actions' : 'Using your custom actions')),
                label: loading
                  ? null
                  : (copy?.label ??
                    (isDefault
                      ? 'These quick actions are curated and approved by OpenFrame.'
                      : 'These quick actions were configured by your organization.')),
              },
            ],
          },
        ]}
      />
    </LoadingWhen>
  );
}

/** View-mode section: heading + source banner + read-only list. In a loading scope, every part its own skeleton. */
export function AiSettingsQuickActionsSection({
  title,
  actions,
  isDefault,
  agentConfig,
  accent,
  bannerCopy,
}: {
  title: string;
  /** Unread while loading. */
  actions?: AiQuickAction[];
  /** Unread while loading. */
  isDefault?: boolean;
  agentConfig: QuickActionsAgentConfig;
  /** Glyph tint override - see `resolveQuickActionAccent`. */
  accent?: QuickActionAccent;
  /** Overrides the source banner copy (leaves the list header on `isDefault`). */
  bannerCopy?: QuickActionsBannerCopy;
}) {
  // Loading: the banner (`StackedRowsPanel`) and the table (`DataTable`) draw their own skeletons in the scope.
  const loading = useLoadingScope() || actions == null;
  return (
    <LoadingWhen loading={loading}>
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <span className="text-ods-text-primary text-h2">{title}</span>
        <QuickActionsSourceBanner isDefault={isDefault} copy={bannerCopy} />
        <AiSettingsQuickActions
          actions={actions ?? NO_ITEMS}
          isDefault={isDefault}
          agentConfig={agentConfig}
          accent={accent}
        />
      </div>
    </LoadingWhen>
  );
}

/**
 * Rows the loading list draws. The list is not paged (every action arrives at once), so there is no page size: this
 * is a typical count.
 */
const QUICK_ACTIONS_SKELETON_ROWS = 4;

interface AiSettingsQuickActionsProps {
  actions: AiQuickAction[];
  /** True → OpenFrame (Product Hub) defaults; false → the organization's customs. Unknown while loading. */
  isDefault?: boolean;
  agentConfig: QuickActionsAgentConfig;
  /** Glyph tint override - see `resolveQuickActionAccent`. */
  accent?: QuickActionAccent;
  className?: string;
}

/**
 * Read-only Quick Actions list (view mode, and the dimmed preview in edit
 * mode). Single-column `DataTable`: the column header carries the source label
 * ("OpenFrame Mingo Quick Actions" / "Organization ... "), the right slot the
 * row count, and each row an icon tile (when the action has a glyph - the
 * same `renderQuickActionIcon` resolution as the chat chip, so url / hub
 * props / picked name all render) beside the name + instructions.
 */
export function AiSettingsQuickActions({
  actions,
  isDefault,
  agentConfig,
  accent,
  className,
}: AiSettingsQuickActionsProps) {
  const glyphAccent = resolveQuickActionAccent(agentConfig, accent);
  const columns = useMemo<ColumnDef<AiQuickAction>[]>(
    () => [
      {
        accessorKey: 'name',
        // Whose list it is (OpenFrame's or the organization's) is read: the header draws its own bar while loading.
        header: `${isDefault ? 'OpenFrame' : 'Organization'} ${agentConfig.agentLabel} Quick Actions`,
        meta: { headerLoading: isDefault == null },
        cell: ({ row }: { row: Row<AiQuickAction> }) => {
          const icon = renderQuickActionIcon({
            name: row.original.iconName ?? undefined,
            url: row.original.iconUrl ?? undefined,
            props: row.original.iconProps ?? undefined,
            accent: glyphAccent,
            size: 16,
          });
          // Figma row (openframe---settings 534-16835): a 32px tile, 16px before the text.
          return (
            <div className="flex min-h-[60px] items-center gap-[var(--spacing-system-s)]">
              {icon && <IconTile className="size-8">{icon}</IconTile>}
              <div className="flex min-w-0 flex-col justify-center">
                <TruncateText>{row.original.name}</TruncateText>
                <TruncateText variant="h6" tone="secondary">
                  {row.original.instructions}
                </TruncateText>
              </div>
            </div>
          );
        },
      },
    ],
    [isDefault, agentConfig.agentLabel, glyphAccent],
  );

  const table = useDataTable<AiQuickAction>({
    data: actions,
    columns,
    getRowId: (row: AiQuickAction) => row.id,
    enableSorting: false,
  });

  return (
    <div className={cn(className)}>
      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount />} />
        <DataTable.Body
          emptyState={{ title: 'No quick actions configured.' }}
          rowClassName="mb-1"
          skeletonRows={QUICK_ACTIONS_SKELETON_ROWS}
        />
      </DataTable>
    </div>
  );
}
