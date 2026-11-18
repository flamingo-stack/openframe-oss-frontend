'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The filter button beside a list's search in a narrow content area, where the columns that carry the funnels are
 * hidden (the phone frames 1098:17357, 1049:16193, 1239:20463): it opens the list's filter window.
 */
export function FilterWindowButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="content-md:hidden"
      onClick={onClick}
      disabled={disabled}
      aria-label="Open filters"
      leftIcon={<Filter02Icon className="text-ods-text-primary" />}
    />
  );
}
