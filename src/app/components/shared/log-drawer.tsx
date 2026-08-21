'use client';

import {
  AppLayoutDrawer,
  AppLayoutDrawerBody,
  AppLayoutDrawerContent,
  AppLayoutDrawerDescription,
  AppLayoutDrawerHeader,
  AppLayoutDrawerTitle,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { DeviceCard, Tag, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { DeviceDetailsButton } from '@/app/(app)/devices/components/device-details-button';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { getDeviceOperatingSystem, getDeviceStatusConfig } from '@/app/(app)/devices/utils/device-status';
import { DeviceInfoSectionSkeleton } from './device-info-section-skeleton';

export interface LogDrawerInfoField {
  label: string;
  value: string | React.ReactNode;
}

interface LogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  description: React.ReactNode;
  statusTag?: {
    label: string;
    variant?: 'success' | 'warning' | 'error' | 'grey' | 'critical';
  };
  timestamp?: string;
  infoFields?: LogDrawerInfoField[];
  /** Device ID — renders a DeviceCard pinned to the bottom */
  deviceId?: string;
  children?: React.ReactNode;
}

function DrawerDeviceCard({ deviceId, onNavigate }: { deviceId: string; onNavigate: () => void }) {
  const { deviceDetails, isLoading } = useDeviceDetails(deviceId, { polling: false });

  if (isLoading) {
    return <DeviceInfoSectionSkeleton />;
  }

  if (!deviceDetails) return null;

  return (
    <DeviceCard
      device={{
        id: deviceDetails.id,
        machineId: deviceDetails.machineId,
        name: deviceDetails.displayName || deviceDetails.hostname || deviceDetails.description || '',
        organization: deviceDetails.organization || deviceDetails.machineId,
        lastSeen: deviceDetails.lastSeen,
        operatingSystem: getDeviceOperatingSystem(deviceDetails.osType),
      }}
      statusTag={
        deviceDetails.status
          ? {
              label: getDeviceStatusConfig(deviceDetails.status).label,
              variant: getDeviceStatusConfig(deviceDetails.status).variant,
            }
          : undefined
      }
      actions={{
        moreButton: { visible: false },
        detailsButton: {
          visible: true,
          component: (
            <DeviceDetailsButton
              deviceId={deviceDetails.id}
              machineId={deviceDetails.machineId}
              className="shrink-0"
              onNavigate={onNavigate}
            />
          ),
        },
      }}
    />
  );
}

export function LogDrawer({
  isOpen,
  onClose,
  description,
  statusTag,
  timestamp,
  infoFields,
  deviceId,
}: LogDrawerProps) {
  const hasDevice = !!deviceId && deviceId !== 'null' && deviceId !== '';

  return (
    <AppLayoutDrawer
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      {/* md:w matches the mobileBreakpoint: below it the panel is forced
          full-bleed, so a fixed width there would detach it from the right edge */}
      <AppLayoutDrawerContent side="right" className="md:w-[400px]">
        {/* Header */}
        <AppLayoutDrawerHeader>
          <AppLayoutDrawerTitle>Log Details</AppLayoutDrawerTitle>

          {description && (
            <AppLayoutDrawerDescription className="text-h4 leading-6 text-ods-text-primary">
              {description}
            </AppLayoutDrawerDescription>
          )}

          {(statusTag || timestamp) && (
            <div className="flex items-center gap-2">
              {statusTag && <Tag label={statusTag.label} variant={statusTag.variant} />}
              {timestamp && <span className="text-h6 text-ods-text-secondary">{timestamp}</span>}
            </div>
          )}
        </AppLayoutDrawerHeader>

        {/* Body */}
        <AppLayoutDrawerBody>
          <div className="flex-1 space-y-4 overflow-y-auto min-h-0">
            {/* Info Card — vertical fields: Value on top, Label below */}
            {infoFields && infoFields.length > 0 && (
              <div className="p-4 bg-ods-card border border-ods-border rounded-[6px] flex flex-col gap-3">
                {infoFields.map(field => (
                  <div key={typeof field.label === 'string' ? field.label : ''} className="flex flex-col gap-0.5">
                    {typeof field.value === 'string' ? (
                      <TruncateText>{field.value || '—'}</TruncateText>
                    ) : (
                      <span className="text-h4 text-ods-text-primary truncate">{field.value || '—'}</span>
                    )}
                    <span className="text-h6 text-ods-text-secondary truncate">{field.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DeviceCard pinned to bottom. Its Details button closes the drawer on
              the way out: this table is embedded in the device detail page itself
              (overview tab), where the button's target is the very URL already
              open — no navigation, nothing moves, and the click reads as broken.
              On mobile the drawer is full-bleed, so it hides the page it just
              "went to" even when the device IS a different one. */}
          {hasDevice && (
            <div className="mt-auto">
              <DrawerDeviceCard deviceId={deviceId} onNavigate={onClose} />
            </div>
          )}
        </AppLayoutDrawerBody>
      </AppLayoutDrawerContent>
    </AppLayoutDrawer>
  );
}
