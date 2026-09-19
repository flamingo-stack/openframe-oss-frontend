'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface SoftwareSearchToolbarProps {
  /** `useStickyToolbar`'s ref — the table's sticky header is measured off this bar. */
  toolbarRef: (node: HTMLDivElement | null) => void;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/** The search bar pinned above a Software table. */
export function SoftwareSearchToolbar({ toolbarRef, placeholder, value, onChange }: SoftwareSearchToolbarProps) {
  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
    >
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1"
        startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
      />
    </div>
  );
}
