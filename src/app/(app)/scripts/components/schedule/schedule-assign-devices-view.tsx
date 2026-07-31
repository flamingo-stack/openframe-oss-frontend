'use client';

import { LoadError, NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import type { Device } from '../../../devices/types/device.types';
import { useScriptSchedule } from '../../hooks/use-script-schedule';
import { useReplaceScheduleAgents } from '../../hooks/use-script-schedule-mutations';
import { formatScheduleDate, getRepeatLabel } from '../../types/script-schedule.types';
import { getDevicePrimaryId } from '../../utils/device-helpers';
import { runDeviceFilter } from '../../utils/script-utils';
import { ScheduleAssignDevicesSkeleton } from './schedule-assign-devices-skeleton';
import { ScheduleInfoBarFromData } from './schedule-info-bar';

interface ScheduleAssignDevicesViewProps {
  scheduleId: string;
}

const getDeviceKey = getDevicePrimaryId;

export function ScheduleAssignDevicesView({ scheduleId }: ScheduleAssignDevicesViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { schedule, isLoading: isLoadingSchedule, error: scheduleError } = useScriptSchedule(scheduleId);
  const replaceAgentsMutation = useReplaceScheduleAgents();

  const [selection, setSelection] = useState<Device[]>([]);

  // TODO(openframe-rmm): Tactical RMM removed — devices were previously sorted by, and the
  // current selection seeded from, Tactical agent IDs. Restore an OpenFrame-RMM-agent
  // mapping once the schedule/assign API is wired up.
  const deviceFilter = useMemo(
    () => runDeviceFilter(schedule?.task_supported_platforms ?? []),
    [schedule?.task_supported_platforms],
  );

  const handleBack = useSafeBack(routes.scripts.schedules.details(scheduleId));

  const handleSave = useCallback(async () => {
    // TODO(openframe-rmm): Tactical RMM removed — assigning devices to a schedule mapped
    // selection to Tactical agent IDs. Until the OpenFrame RMM schedule API is wired up we
    // pass the device primary ids; the mutation itself rejects (migration pending) and the
    // catch surfaces a clear toast. See scripts-migration.ts.
    const agentIds = selection.map(getDevicePrimaryId);

    try {
      await replaceAgentsMutation.mutateAsync({
        id: scheduleId,
        agents: agentIds,
      });
      toast({
        title: 'Devices saved',
        description: `${agentIds.length} device(s) assigned to schedule.`,
        variant: 'success',
      });
      safeBackOrReplace(router, routes.scripts.schedules.details(scheduleId, { tab: 'schedule-devices' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save devices';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    }
  }, [replaceAgentsMutation, scheduleId, selection, toast, router]);

  const actions = useMemo(
    () => [
      {
        label: 'Cancel',
        onClick: handleBack,
        variant: 'outline' as const,
        showOnlyMobile: true,
      },
      {
        label: 'Save Devices',
        onClick: handleSave,
        variant: 'accent' as const,
        loading: replaceAgentsMutation.isPending,
      },
    ],
    [handleSave, replaceAgentsMutation.isPending, handleBack],
  );

  if (isLoadingSchedule) {
    return <ScheduleAssignDevicesSkeleton />;
  }

  if (scheduleError) {
    return <LoadError message={`Error loading schedule: ${scheduleError}`} />;
  }

  if (!schedule) {
    return <NotFoundError message="Schedule not found" />;
  }

  const { date, time } = formatScheduleDate(schedule.run_time_date);
  const repeat = getRepeatLabel(schedule);

  return (
    <PageLayout
      title="Schedule Devices"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-6 overflow-auto">
        <DeviceListPicker
          filter={deviceFilter}
          selected={selection}
          onSelectionChange={setSelection}
          getDeviceKey={getDeviceKey}
          addAllBehavior="replace"
          headerContent={
            <ScheduleInfoBarFromData
              name={schedule.name}
              note=""
              date={date}
              time={time}
              repeat={repeat}
              platforms={schedule.task_supported_platforms}
            />
          }
        />
      </div>
    </PageLayout>
  );
}
