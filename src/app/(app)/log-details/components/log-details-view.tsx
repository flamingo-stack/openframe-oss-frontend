'use client';

import { ToolBadge } from '@flamingo-stack/openframe-frontend-core/components';
import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, PageLayout, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { normalizeToolTypeWithFallback } from '@flamingo-stack/openframe-frontend-core/utils';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DeviceInfoSection } from '@/app/components/shared';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { formatLogDetailsForCopy } from '../../logs-page/utils/format-log-details';
import { useLogDetails } from '../hooks/use-log-details';
import { DetailsSection } from './details-section';
import { FullInformationSection } from './full-information-section';
import { LogDetailsSkeleton } from './log-details-skeleton';

interface LogDetailsViewProps {
  logId: string;
  ingestDay: string;
  toolType: string;
  eventType: string;
  timestamp: string;
}

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

export function LogDetailsView({ logId, ingestDay, toolType, eventType, timestamp }: LogDetailsViewProps) {
  const router = useRouter();
  const { logDetails, isLoading, error, fetchLogDetailsById } = useLogDetails();
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

  // Loading state
  if (isLoading) {
    return <LogDetailsSkeleton onBack={handleBackToLogs} />;
  }

  // Error state
  if (error || !logDetails) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-ods-text-primary text-h2">Log Not Found</h2>
          <p className="mb-4 text-ods-text-secondary">{error || `Could not find log with ID: ${logId}`}</p>
          <Button
            onClick={handleBackToLogs}
            className="rounded-[6px] border border-ods-border bg-ods-card px-4 py-3 font-bold text-ods-text-primary text-h6 hover:bg-ods-bg-hover"
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
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
          icon: copied ? <CheckIcon className="h-6 w-6 text-ods-success" /> : <Copy02Icon className="h-6 w-6" />,
        },
      ]}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex w-full flex-col gap-6">
        {/* Status and Timestamp */}
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
          <Tag label={logDetails.severity} variant={getSeverityVariant(logDetails.severity)} />
          <span className="text-ods-text-primary text-h4">{formatDateTime(logDetails.timestamp)}</span>
        </div>

        {/* Log Summary Card */}
        <div className="w-full rounded-[8px] border border-ods-border bg-ods-card">
          <div className="flex flex-col items-start gap-4 p-4 md:p-6">
            <div className="flex w-full flex-col gap-2">
              <div className="break-words text-ods-text-primary text-h4">
                {logDetails.message || 'No message available'}
              </div>
              <div className="flex items-center gap-2 text-ods-text-secondary text-h6">
                <ToolBadge toolType={normalizeToolTypeWithFallback(logDetails.toolType)} />
                <span>•</span>
                <span>{logDetails.eventType}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Device Info Section */}
        {logDetails.deviceId && <DeviceInfoSection deviceId={logDetails.deviceId} device={logDetails.device} />}

        {/* Full Information Section */}
        <FullInformationSection logDetails={logDetails} />

        {/* Details Section */}
        <DetailsSection logDetails={logDetails} />
      </div>
    </PageLayout>
  );
}
