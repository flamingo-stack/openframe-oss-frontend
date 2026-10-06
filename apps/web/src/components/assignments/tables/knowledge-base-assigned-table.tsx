'use client';

import {
  type KnowledgeBaseRow,
  KnowledgeBaseTableBody,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { knowledgeBaseRowHref } from '@/app/(app)/knowledge-base/components/knowledge-base-row-href';

interface KnowledgeBaseAssignedTableProps {
  articles: KnowledgeBaseRow[];
  isLoading?: boolean;
}

export function KnowledgeBaseAssignedTable({ articles, isLoading }: KnowledgeBaseAssignedTableProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter(a => {
      const name = a.name.toLowerCase();
      const summary = (a.summary ?? '').toLowerCase();
      return name.includes(needle) || summary.includes(needle);
    });
  }, [articles, debouncedSearch]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      <Input
        placeholder="Search for Knowledge Article"
        value={search}
        onChange={e => setSearch(e.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
      />
      <KnowledgeBaseTableBody
        items={filtered}
        getHref={knowledgeBaseRowHref}
        mode="standard"
        isLoading={isLoading}
        emptyMessage="No articles assigned."
        skeletonRows={3}
      />
    </div>
  );
}
