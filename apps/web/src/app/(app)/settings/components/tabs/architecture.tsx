'use client';

import { PageLayout, ServiceCard } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { type IntegratedTool, useIntegratedTools } from '../../hooks/use-integrated-tools';

interface ArchitectureTabProps {
  title?: string;
}

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
          startAdornment={<SearchIcon />}
          placeholder="Search for Tools..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>
      <LoadingWhen loading={isLoading}>
        {isLoading ? (
          <ArchitectureLayer layer={null} tools={[]} />
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
const CARD_CLASS = 'rounded-lg border border-ods-border bg-ods-card p-6';

/** A layer's heading and its tools; in a loading scope, its skeleton (`layer` and `tools` unread). */
function ArchitectureLayer({ layer, tools }: { layer: string | null; tools: IntegratedTool[] }) {
  if (useLoadingScope() || layer == null) return <ArchitectureLayerSkeleton />;
  return (
    <div className="space-y-4" data-loading-item>
      <div className="text-ods-text-primary text-h2">{layer}</div>
      <div className={LAYER_GRID_CLASS}>
        {tools.map(tool => (
          <ArchitectureToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}

function ArchitectureLayerSkeleton() {
  return (
    <div className="space-y-4" data-loading-item>
      <TextLineSkeleton type="h2" className="w-40" />
      <div className={LAYER_GRID_CLASS}>
        {Array.from({ length: ARCHITECTURE_SKELETON_TOOLS }, (_, i) => (
          <ArchitectureToolCard key={i} tool={null} />
        ))}
      </div>
    </div>
  );
}

/** The same frame and rows as the lib's `ServiceCard`, which draws no skeleton of its own. */
function ArchitectureToolCardSkeleton() {
  return (
    <div className={CARD_CLASS} data-loading-item>
      <div className="mb-4 flex items-center gap-4">
        <UnifiedSkeleton className="h-12 w-12 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <TextLineSkeleton type="h3" className="w-3/4" />
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <TextLineSkeleton type="h6" className="w-20 shrink-0 content-md:w-24" />
        <UnifiedSkeleton className="h-12 min-w-0 flex-1 rounded-md" />
      </div>
    </div>
  );
}

/** One tool: its links and credentials, each a copyable row. In a loading scope, its skeleton. */
function ArchitectureToolCard({ tool }: { tool: IntegratedTool | null }) {
  if (useLoadingScope() || tool == null) return <ArchitectureToolCardSkeleton />;
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
    <div data-loading-item>
      <ServiceCard
        title={tool.name}
        subtitle={tool.description || ''}
        tag={tool.category ? { label: tool.category } : undefined}
        rows={rows}
      />
    </div>
  );
}
