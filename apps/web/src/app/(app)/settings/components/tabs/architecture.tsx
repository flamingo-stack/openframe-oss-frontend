'use client';

import { PageLayout, ServiceCard, type ServiceCardRow } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Input,
  LoadingItems,
  LoadingWhen,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { type IntegratedTool, useIntegratedTools } from '../../hooks/use-integrated-tools';

interface ArchitectureTabProps {
  title?: string;
}

/**
 * Layers the loading page draws. The layers are free text on each tool and not paged, so there is no page size: this is
 * a typical count (a deployment's catalog groups its tools into a few layers), not a claim about how many exist.
 */
const ARCHITECTURE_SKELETON_LAYERS = 3;

const NO_TOOLS: IntegratedTool[] = [];

export function ArchitectureTab({ title = 'Architecture Overview' }: ArchitectureTabProps) {
  const handleBack = useSafeBack(routes.settings.root());
  const { tools, isLoading, fetchIntegratedTools } = useIntegratedTools();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchIntegratedTools({ enabled: true, category: null }).catch(() => {});
  }, [fetchIntegratedTools]);

  const filteredTools = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tools;
    return tools.filter(t => {
      const name = t.name?.toLowerCase() || '';
      const description = t.description?.toLowerCase() || '';
      const category = (t.category as unknown as string)?.toLowerCase?.() || '';
      const layer = (t.layer as unknown as string)?.toLowerCase?.() || '';
      const urls = (t.toolUrls || []).map(u => (u?.url || '').toLowerCase());
      return (
        name.includes(term) ||
        description.includes(term) ||
        category.includes(term) ||
        layer.includes(term) ||
        urls.some(u => u.includes(term))
      );
    });
  }, [tools, searchTerm]);

  // Group by layer (after filtering)
  const grouped: Record<string, typeof tools> = {};
  for (const t of filteredTools) {
    const layer = (t.layer as unknown as string) || 'Other';
    (grouped[layer] ??= []).push(t);
  }

  const layerOrder = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <PageLayout
      title={title}
      className="bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
    >
      <div>
        <Input
          userValue
          startAdornment={<SearchIcon />}
          placeholder="Search for Tools..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>
      <LoadingWhen loading={isLoading}>
        {isLoading ? (
          <LoadingItems count={ARCHITECTURE_SKELETON_LAYERS}>
            {() => <ArchitectureLayer layer={null} tools={NO_TOOLS} />}
          </LoadingItems>
        ) : (
          layerOrder.map(layer => <ArchitectureLayer key={layer} layer={layer} tools={grouped[layer]} />)
        )}
      </LoadingWhen>
    </PageLayout>
  );
}

/**
 * Tools the loading list draws. The list is not paged (every enabled tool arrives at once), so there is no page size
 * to draw: this is a typical layer's count.
 */
const ARCHITECTURE_SKELETON_TOOLS = 4;
const LAYER_GRID_CLASS = 'grid grid-cols-1 gap-6 content-md:grid-cols-2';

/**
 * A layer's heading and its tools. In a loading scope (`layer` and `tools` unread) the heading is a bar and the grid
 * holds a typical layer's count of loading cards.
 */
function ArchitectureLayer({ layer, tools }: { layer: string | null; tools: IntegratedTool[] }) {
  const loading = useLoadingScope() || layer == null;
  return (
    <div className="space-y-4" data-loading-item>
      {loading ? (
        <TextLineSkeleton type="h2" className="w-40" />
      ) : (
        <div className="text-ods-text-primary text-h2">{layer}</div>
      )}
      <div className={LAYER_GRID_CLASS}>
        {loading ? (
          <LoadingItems count={ARCHITECTURE_SKELETON_TOOLS}>{() => <ArchitectureToolCard tool={null} />}</LoadingItems>
        ) : (
          tools.map(tool => <ArchitectureToolCard key={tool.id} tool={tool} />)
        )}
      </div>
    </div>
  );
}

/**
 * Rows a loading tool card draws: a tool's links and credentials vary, and two (its address and one credential) is
 * the typical count. Each row's label (the link's type) is read too: an empty label keeps the label column, drawn as
 * a bar by the card.
 */
const ARCHITECTURE_SKELETON_ROWS: ServiceCardRow[] = [
  { label: '', value: '' },
  { label: '', value: '' },
];
/** The integrated tools carry a category (optional in the schema, set on the catalog's tools): the tag is drawn while loading, a bar for its read label. */
const ARCHITECTURE_SKELETON_TAG = { label: '' };

/** One tool: its links and credentials, each a copyable row. In a loading scope, the lib's card draws its own bars. */
function ArchitectureToolCard({ tool }: { tool: IntegratedTool | null }) {
  if (useLoadingScope() || tool == null) {
    return (
      <ServiceCard
        data-loading-item
        title=""
        subtitle=""
        tag={ARCHITECTURE_SKELETON_TAG}
        rows={ARCHITECTURE_SKELETON_ROWS}
        loading
      />
    );
  }
  const rows: Array<{
    label?: string;
    value: string;
    href?: string;
    isSecret?: boolean;
    actions?: { copy?: boolean; open?: boolean; reveal?: boolean };
  }> = [];
  const urls = tool.toolUrls || [];
  urls.forEach(u => {
    if (!u?.url) return;
    const formattedType = (u.type || 'Link').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Concatenate port to URL if port exists
    const fullUrl = u.port ? `${u.url}:${u.port}` : u.url;

    rows.push({ label: formattedType, value: fullUrl, href: fullUrl, actions: { copy: true, open: true } });

    // Display port as a separate row if it exists
    if (u.port) {
      rows.push({ label: 'Port', value: String(u.port), actions: { copy: true } });
    }
  });
  if (tool.credentials?.username)
    rows.push({ label: 'User', value: tool.credentials.username, actions: { copy: true } });
  if (tool.credentials?.password)
    rows.push({
      label: 'Pass',
      value: tool.credentials.password,
      isSecret: true,
      actions: { reveal: true, copy: true },
    });
  if (tool.credentials?.apiKey?.key)
    rows.push({
      label: tool.credentials.apiKey.keyName || 'API Key',
      value: tool.credentials.apiKey.key,
      isSecret: true,
      actions: { reveal: true, copy: true },
    });

  return (
    <ServiceCard
      data-loading-item
      title={tool.name}
      subtitle={tool.description || ''}
      tag={tool.category ? { label: tool.category } : undefined}
      rows={rows}
    />
  );
}
