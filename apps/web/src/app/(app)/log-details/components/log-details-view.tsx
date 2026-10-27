'use client';

import { TextLineSkeleton, ToolBadge } from '@flamingo-stack/openframe-frontend-core/components';
import { CheckIcon, Chevron02LeftIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  LoadingWhen,
  PageLayout,
  Tag,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { normalizeToolTypeWithFallback } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DeviceInfoSection } from '@/app/components/shared';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { ValueText } from '@/app/components/shared/value-text';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { formatLogDetailsForCopy } from '../../logs-page/utils/format-log-details';
import { useLogDetails } from '../hooks/use-log-details';
import { DetailsSection } from './details-section';
import { FullInformationSection } from './full-information-section';

interface LogDetailsViewProps {
  logId: string;
  ingestDay: string;
  toolType: string;
  eventType: string;
  timestamp: string;
}

/**
 * How many lines a log's message typically runs to: an agent's one-sentence event ("Script <name> executed."), one
 * line at every width the page is drawn at, the docked chat's narrow column and a phone included (measured).
 */
const LOG_MESSAGE_SKELETON_LINES = 1;

const getSeverityVariant = (severity: string): 'success' | 'warning' | 'error' | 'grey' | 'critical' => {
  switch (severity?.toUpperCase()) {
    case 'ERROR':
      return 'error';
    case 'WARNING':
      return 'warning';
    case 'INFO':
      return 'grey';
    case 'CRITICAL':
      return 'critical';
    case 'DEBUG':
    default:
      return 'grey';
  }
};

/** The log's event type, in its caption line; a bar of that line while the log is read (or in a loading scope). */
function EventTypeText({ eventType }: { eventType: string | undefined }) {
  if (useLoadingScope() || eventType === undefined) return <TextLineSkeleton type="h6" as="span" className="w-28" />;
  return <span>{eventType}</span>;
}

export function LogDetailsView({ logId, ingestDay, toolType, eventType, timestamp }: LogDetailsViewProps) {
  const router = useRouter();
  const { logDetails, isLoading, hasAnswered, error, fetchLogDetailsById } = useLogDetails();
  const { copy, copied } = useCopyToClipboard({
    successDescription: 'Log details copied to clipboard',
    errorDescription: 'Unable to copy log details',
  });

  useEffect(() => {
    if (logId && ingestDay && toolType && eventType && timestamp) {
      fetchLogDetailsById(logId, ingestDay, toolType, eventType, timestamp);
    } else {
      router.replace(routes.logs.page);
    }
  }, [logId, ingestDay, toolType, eventType, timestamp, fetchLogDetailsById, router]);

  const handleBackToLogs = useSafeBack(routes.logs.page);

  const handleCopyLogDetails = () => {
    if (logDetails) {
      copy(formatLogDetailsForCopy(logDetails));
    }
  };

  // Until the request answers (it starts after the first render) the page draws itself without the log. An
  // answer with no log is "Log Not Found", not more loading.
  const loading = isLoading || !hasAnswered;

  // Error state
  if (!loading && (error || !logDetails)) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-ods-text-primary text-h2">Log Not Found</h2>
          <p className="mb-4 text-ods-text-secondary">{error || `Could not find log with ID: ${logId}`}</p>
          <Button
            onClick={handleBackToLogs}
            className="rounded-[6px] border border-ods-border bg-ods-card px-4 py-3 font-bold text-ods-text-primary text-h6 hover:bg-ods-bg-hover"
            leftIcon={<Chevron02LeftIcon className="h-4 w-4" />}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  const log = loading ? null : logDetails;

  return (
    <LoadingWhen loading={!log}>
      <PageLayout
        title="Log Details"
        backButton={{
          label: 'Back',
          onClick: handleBackToLogs,
        }}
        actions={[
          {
            label: 'Copy Log Details',
            onClick: handleCopyLogDetails,
            variant: 'outline' as const,
            disabled: !log,
            icon: copied ? <CheckIcon className="h-6 w-6 text-ods-success" /> : <Copy02Icon className="h-6 w-6" />,
          },
        ]}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        <div className="flex w-full flex-col gap-6">
          {/* Status and Timestamp */}
          <div className="flex flex-col items-start gap-3 content-md:flex-row content-md:items-center content-md:gap-4">
            {/* The tag draws its own skeleton in the loading scope. */}
            <Tag label={log?.severity ?? ''} variant={log ? getSeverityVariant(log.severity) : undefined} />
            <span className="text-ods-text-primary text-h4">
              <ValueText value={log ? formatDateTime(log.timestamp) : undefined} skeletonWidth="w-40" />
            </span>
          </div>

          {/* Log Summary Card */}
          <div className="w-full rounded-[8px] border border-ods-border bg-ods-card">
            <div className="flex flex-col items-start gap-4 p-4 content-md:p-6">
              <div className="flex w-full flex-col gap-2">
                <LoadingParagraph
                  text={log ? log.message || 'No message available' : undefined}
                  tone="primary"
                  className="break-words"
                  lines={LOG_MESSAGE_SKELETON_LINES}
                />
                <div className="flex items-center gap-2 text-ods-text-secondary text-h6">
                  <ToolBadge toolType={normalizeToolTypeWithFallback(log?.toolType ?? '')} />
                  <span>•</span>
                  <EventTypeText eventType={log?.eventType} />
                </div>
              </div>
            </div>
          </div>

          {/* Device Info Section: always drawn (a log with no device shows the empty mark). */}
          <DeviceInfoSection deviceId={log?.deviceId} device={log?.device} />

          {/* Full Information Section */}
          <FullInformationSection logDetails={log} />

          {/* Details Section */}
          <DetailsSection logDetails={log} />
        </div>
      </PageLayout>
    </LoadingWhen>
  );
}
