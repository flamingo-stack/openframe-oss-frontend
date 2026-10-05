'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { ExecutionSource } from '@/generated/schema-enums';

/**
 * How an execution was triggered, as the chip beside the initiator in Execution
 * History (Figma 155:38356).
 *
 * `MANUAL` renders nothing: the initiator is the technician who clicked Run, so
 * a chip would only restate the name next to it. The other two qualify that
 * name — a schedule fired it, or Mingo dispatched it on their behalf. Returning
 * `null` lets call sites drop this in without repeating the check.
 */
export function ExecutionSourceBadge({
  source,
  className,
}: {
  source: ExecutionSource | string | null | undefined;
  className?: string;
}) {
  // `span`, not the default `div`: this renders inside a text line.
  // Never shrink — the initiator name beside it is what ellipsizes.
  // Labels are sentence case here; `Tag`'s h5 type scale is what uppercases them.
  const tagProps = { as: 'span', variant: 'outline', className: cn('shrink-0', className) } as const;

  if (source === ExecutionSource.SCHEDULED) {
    return <Tag {...tagProps} label="Scheduled" />;
  }

  if (source === ExecutionSource.AI_ASSISTANT) {
    return (
      <Tag
        {...tagProps}
        label="Mingo"
        icon={
          // White body with cyan eyes and corner — the logo's own two-tone
          // treatment, same as everywhere else Mingo is stamped in the app.
          <MingoIcon
            className="size-4"
            eyesColor="var(--ods-flamingo-cyan-base)"
            cornerColor="var(--ods-flamingo-cyan-base)"
          />
        }
      />
    );
  }

  return null;
}
