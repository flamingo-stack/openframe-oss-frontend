'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  InfoSection,
  NotFoundError,
  type PageActionButton,
  PageLayout,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { endConnectionViewQuery as EndConnectionViewQueryType } from '@/__generated__/endConnectionViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { wrapping } from '../tenant-detail/tenant-integration-section';
import {
  customerTenantSteps,
  customerTenantStepsText,
  deleteSections,
  disconnectSections,
  endConnectionIntro,
  type EndConnectionMode,
  type EndConnectionRecord,
} from './end-connection-copy';
import { useEndConnection } from './use-end-connection';

// `impact` runs a few counts: one connection's page, never a list.
const endConnectionViewQuery = graphql`
  query endConnectionViewQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      id
      name
      provider
      impact {
        users
        groups
        licenseAssignments
        cloudOnlyDevices
        agentDeviceLinks
      }
    }
  }
`;

const VERB: Record<EndConnectionMode, string> = { disconnect: 'Disconnect', delete: 'Delete' };

const BUTTON: Record<EndConnectionMode, Pick<PageActionButton, 'label' | 'variant'>> = {
  disconnect: { label: 'Disconnect', variant: 'accent' },
  delete: { label: 'Delete Connection', variant: 'destructive' },
};

const INTRO_SKELETON_LINES = 2;
const STEPS_SKELETON_LINES = 4;

const TITLE_SKELETON_LINES = { phone: 2, md: 1, lg: 1 } as const;

/** "In the customer tenant": what only the customer's admin can do, ready to send to them. */
function CustomerTenantSteps({ provider }: { provider: string | null }) {
  const loading = useLoadingScope();
  const { copy } = useCopyToClipboard({ successDescription: 'Instructions copied to clipboard' });
  const { intro, items, note } = customerTenantSteps(provider);
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="text-ods-text-secondary text-h5">In the customer tenant</h3>
      <div className="flex flex-col items-start gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        {loading ? (
          <LoadingParagraph loading text="" tone="primary" lines={STEPS_SKELETON_LINES} />
        ) : (
          <div className="flex flex-col text-ods-text-primary text-h4">
            <p>{intro}</p>
            <ul className="list-disc pl-[var(--spacing-system-l)]">
              {items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {note && <p className="pl-[var(--spacing-system-l)]">{note}</p>}
          </div>
        )}
        <Button
          variant="outline"
          disabled={loading}
          leftIcon={<Copy02Icon className="h-5 w-5 text-ods-text-secondary" />}
          onClick={() => copy(customerTenantStepsText(provider))}
        >
          Copy Instructions
        </Button>
      </div>
    </section>
  );
}

interface EndConnectionPageProps {
  id: string;
  mode: EndConnectionMode;
}

/**
 * The page's frame and everything on it, from the record it is handed (`null` while it is read): the title and the
 * counts are bars, the labels and the sentences that do not depend on the record are real. The button stays locked.
 */
function EndConnectionPage({
  id,
  mode,
  connection,
}: EndConnectionPageProps & { connection: EndConnectionRecord | null }) {
  const details = routes.cloudTenantManagement.details(id);
  const handleBack = useSafeBack(details);
  const router = useRouter();
  const { submit, isSubmitting } = useEndConnection(connection?.id ?? null, mode);
  const provider = connection?.provider ?? null;
  const impact = connection?.impact ?? null;
  const sections = mode === 'delete' ? deleteSections(impact, provider) : disconnectSections(impact);
  return (
    <PageLayout
      title={connection ? `${VERB[mode]} ${connection.name}` : VERB[mode]}
      loading={!connection}
      titleSkeletonLines={TITLE_SKELETON_LINES}
      backButton={{ label: 'Back', onClick: handleBack }}
      actionsVariant="primary-buttons"
      actions={[
        // A phone's bottom bar has no room for the title's Back (Figma 3604-1132).
        { label: 'Cancel', variant: 'outline', showOnlyMobile: true, onClick: () => router.push(details) },
        { ...BUTTON[mode], onClick: submit, disabled: !connection || isSubmitting, loading: isSubmitting },
      ]}
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <LoadingParagraph
          loading={!connection}
          text={connection ? endConnectionIntro(mode, provider) : ''}
          tone="primary"
          lines={INTRO_SKELETON_LINES}
        />
        {sections.map(section => (
          <InfoSection
            key={section.title}
            title={section.title}
            rows={section.rows.map(row => ({
              id: row.id,
              label: row.label,
              value: row.value ? wrapping(row.value) : { text: '' },
            }))}
          />
        ))}
        <CustomerTenantSteps provider={provider} />
      </div>
    </PageLayout>
  );
}

/** Disconnect or Delete (Figma 3287-23208, 3287-22492): what stops, what stays, what goes, then the one button. */
export function EndConnectionView(props: EndConnectionPageProps) {
  return (
    <LoadingSuspense live label="Loading tenant">
      <EndConnectionReader {...props} />
    </LoadingSuspense>
  );
}

function EndConnectionReader(props: EndConnectionPageProps) {
  if (useLoadingScope()) return <EndConnectionPage {...props} connection={null} />;
  return <EndConnectionQuery {...props} />;
}

function EndConnectionQuery(props: EndConnectionPageProps) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<EndConnectionViewQueryType>(
    endConnectionViewQuery,
    { id: props.id },
    { fetchPolicy: 'network-only', fetchKey: retryKey },
  );
  if (!connection) {
    return (
      <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
    );
  }
  return <EndConnectionPage {...props} connection={connection} />;
}
