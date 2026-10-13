'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import {
  BookBookmarkIcon,
  BracketCurlyIcon,
  ClipboardListIcon,
  MonitorIcon,
  RadarIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { SetupHeading } from '../components/setup-heading';

const AREAS: { label: string; icon: ReactNode }[] = [
  { label: 'Devices', icon: <MonitorIcon className="size-4" /> },
  { label: 'Tickets', icon: <TagIcon className="size-4" /> },
  { label: 'Scripting', icon: <BracketCurlyIcon className="size-4" /> },
  { label: 'Monitoring', icon: <RadarIcon className="size-4" /> },
  { label: 'Logging', icon: <ClipboardListIcon className="size-4" /> },
  { label: 'Knowledge Management', icon: <BookBookmarkIcon className="size-4" /> },
];

/**
 * "Everything is set up": what every admin after the first sees instead of the
 * wizard - the workspace is set up, here is what Mingo covers, go meet it.
 */
export function AllSetStep({ onStart, starting }: { onStart: () => void; starting: boolean }) {
  return (
    <>
      <SetupHeading
        title="Everything is set up"
        subtitle={
          <span className="inline-flex max-w-[640px] flex-wrap items-center justify-center gap-x-[var(--spacing-system-xxs)] gap-y-[var(--spacing-system-xxs)]">
            Mingo can help you with
            {AREAS.map((area, index) => (
              <span key={area.label} className="inline-flex items-center gap-[var(--spacing-system-xxs)]">
                <Tag as="span" variant="outline" icon={area.icon} label={area.label} />
                {index < AREAS.length - 2 ? ',' : index === AREAS.length - 2 ? ' and' : '.'}
              </span>
            ))}
            Just ask.
          </span>
        }
      />
      <Button
        variant="outline"
        leftIcon={<AgentMark agent="mingo" className="size-5 text-ods-flamingo-cyan" color="currentColor" />}
        onClick={onStart}
        loading={starting}
        disabled={starting}
        className="w-full sm:w-auto sm:min-w-[204px]"
      >
        Start with Mingo
      </Button>
    </>
  );
}
