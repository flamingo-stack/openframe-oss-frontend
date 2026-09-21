'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Chevron01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { openMingoDialogInDrawer } from '@/app/components/notifications/open-mingo-dialog';
import { ContentErrorBoundary } from '@/app/components/shared';
import { formatDateTime } from '@/lib/format-date';
import type { DialogNode } from '../../mingo/types';
import { useIncident } from '../hooks/use-incident';
import { useIncidentDialogs } from '../hooks/use-incident-dialogs';

/** A title is generated after the first exchange; until then the list shows the same placeholder as the drawer. */
const UNTITLED = 'New Chat';

function sessionMeta(dialog: DialogNode): string {
  const user = dialog.owner?.user;
  const by = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
  const when = dialog.createdAt ? formatDateTime(dialog.createdAt) : '';
  return [when, by].filter(Boolean).join(' · ');
}

function SessionsList({ insightId }: { insightId: string }) {
  const { data: dialogs } = useIncidentDialogs(insightId);
  if (!dialogs || dialogs.length === 0) return null;
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <p className="text-ods-text-secondary text-h5">Mingo Sessions</p>
      <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
        {dialogs.map(dialog => (
          // Opens the drawer on that conversation — the same path a notification click takes.
          <button
            key={dialog.id}
            type="button"
            onClick={() => openMingoDialogInDrawer(dialog.id)}
            className="flex w-full items-center gap-[var(--spacing-system-s)] rounded-[6px] border border-ods-border bg-ods-card px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-left transition-colors hover:bg-ods-bg-active"
          >
            <MingoIcon
              className="size-6 shrink-0"
              eyesColor="var(--ods-flamingo-cyan-base)"
              cornerColor="var(--ods-flamingo-cyan-base)"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <TruncateText>{dialog.title || UNTITLED}</TruncateText>
              <TruncateText variant="h6" tone="secondary">
                {sessionMeta(dialog)}
              </TruncateText>
            </div>
            <Chevron01RightIcon className="size-5 shrink-0 text-ods-text-secondary" />
          </button>
        ))}
      </div>
    </section>
  );
}

/** The record is needed for its STORED id — the dialog filter keys on that, not the Relay handle. */
function SessionsForIncident({ incidentId }: { incidentId: string }) {
  const incident = useIncident(incidentId);
  return <SessionsList insightId={incident.insightId} />;
}

/**
 * The Mingo chats started from this incident, each opening in the drawer.
 * Nothing is drawn while they load or when there are none — a secondary list
 * under the notes, not a slot the page reserves.
 */
export function IncidentSessions({ incidentId }: { incidentId: string }) {
  return (
    <ContentErrorBoundary title="Mingo Sessions" message="Couldn't load the Mingo sessions.">
      <Suspense fallback={null}>
        <SessionsForIncident incidentId={incidentId} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
