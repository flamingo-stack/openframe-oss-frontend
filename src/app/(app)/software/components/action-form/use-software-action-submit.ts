'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { graphql, useMutation } from 'react-relay';
import type { useSoftwareActionSubmitInstallMutation as InstallMutationType } from '@/__generated__/useSoftwareActionSubmitInstallMutation.graphql';
import type { useSoftwareActionSubmitScheduleMutation as ScheduleMutationType } from '@/__generated__/useSoftwareActionSubmitScheduleMutation.graphql';
import type { useSoftwareActionSubmitUpdateMutation as UpdateMutationType } from '@/__generated__/useSoftwareActionSubmitUpdateMutation.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import {
  applyTimeSlot,
  isScheduleStartInPast,
  PAST_START_MESSAGE,
  toScheduleInstant,
} from '@/app/(app)/scripts/schedule/utils/schedule-timing';
import { type ScheduleTimeReference, SoftwareAction } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { type PackageInput, type SoftwareRow, toPackageInputs } from './software-row';

/**
 * Installs catalog packages on the given devices, now. Each package is its own
 * RMM execution, so the result is one row per package with its executionId.
 */
const installMutation = graphql`
  mutation useSoftwareActionSubmitInstallMutation($input: SoftwareManagementInput!) {
    installSoftware(input: $input) {
      executionId
    }
  }
`;

/** Updates catalog packages on the given devices, now — one result per package. */
const updateMutation = graphql`
  mutation useSoftwareActionSubmitUpdateMutation($input: SoftwareManagementInput!) {
    updateSoftware(input: $input) {
      executionId
    }
  }
`;

/** Schedules a deferred install or update of catalog packages on the given devices. */
const scheduleMutation = graphql`
  mutation useSoftwareActionSubmitScheduleMutation($input: CreateSoftwareScheduleInput!) {
    createSoftwareSchedule(input: $input) {
      id
    }
  }
`;

export type RunMode = 'now' | 'schedule';

export interface SoftwareActionForm {
  rows: SoftwareRow[];
  selection: Device[];
  mode: RunMode;
  date: Date | null;
  time: string;
  timeReference: ScheduleTimeReference;
}

/**
 * The page's submit: validates the form, then runs it now (`installSoftware` /
 * `updateSoftware`) or schedules it (`createSoftwareSchedule` with the matching
 * `action`).
 *
 * A run-now of one package lands on that run's details; several packages are
 * several runs, and a schedule has no run yet — both land on Software Actions,
 * which lists them.
 */
interface SoftwareActionSubmit {
  submit: (form: SoftwareActionForm) => void;
  isSubmitting: boolean;
}

export function useSoftwareActionSubmit(action: SoftwareAction): SoftwareActionSubmit {
  const copy = SOFTWARE_ACTION_COPY[action];
  const router = useRouter();
  const { toast } = useToast();

  const [commitInstall, isInstalling] = useMutation<InstallMutationType>(installMutation);
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateMutation);
  const [commitSchedule, isScheduling] = useMutation<ScheduleMutationType>(scheduleMutation);

  const fail = (title: string, description: string) => {
    toast({ title, description, variant: 'destructive' });
  };

  const runNow = (packages: PackageInput[], selection: Device[]) => {
    const machineIds = selection.flatMap(device => (device.machineId ? [device.machineId] : []));
    const variables = { input: { machineIds, packages } };
    const onCompleted = (runs: ReadonlyArray<{ readonly executionId: string }>) => {
      toast({
        title: copy.started,
        description: `${packages.length === 1 ? packages[0].packageName : pluralize(packages.length, 'package')} on ${pluralize(machineIds.length, 'device')}.`,
        variant: 'success',
      });
      const [only] = runs;
      router.push(
        runs.length === 1 && packages.length === 1 ? routes.software.action(only.executionId) : routes.software.actions,
      );
    };
    const onError = (error: Error) => fail('Error', getRelayErrorMessage(error, copy.failed));
    if (action === SoftwareAction.UPDATE) {
      commitUpdate({ variables, onCompleted: response => onCompleted(response.updateSoftware), onError });
    } else {
      commitInstall({ variables, onCompleted: response => onCompleted(response.installSoftware), onError });
    }
  };

  const schedule = (packages: PackageInput[], form: SoftwareActionForm) => {
    const { date, time, timeReference, selection } = form;
    if (!date || !time) {
      fail('No start time', 'Pick a date and time for the schedule.');
      return;
    }
    if (isScheduleStartInPast(date, time, timeReference)) {
      fail('Invalid start time', PAST_START_MESSAGE);
      return;
    }
    commitSchedule({
      variables: {
        input: {
          name: `${copy.verb} ${packages.map(pkg => pkg.packageName).join(', ')}`,
          action,
          packages,
          timeReference,
          startAt: toScheduleInstant(applyTimeSlot(date, time), timeReference),
          // Schedules take Machine global ids, unlike the run-now mutations.
          machineIds: selection.map(device => device.id),
        },
      },
      onCompleted: () => {
        toast({ title: copy.scheduled, description: 'It will run at the scheduled time.', variant: 'success' });
        router.push(routes.software.actions);
      },
      onError: error => fail('Error', getRelayErrorMessage(error, 'Failed to create the schedule')),
    });
  };

  const submit = (form: SoftwareActionForm) => {
    const packages = toPackageInputs(form.rows);
    if (!packages) {
      fail('No software selected', 'Pick a package in every row, or remove the empty ones.');
      return;
    }
    if (form.selection.length === 0) {
      fail('No devices selected', 'Please select at least one device.');
      return;
    }
    if (form.mode === 'now') runNow(packages, form.selection);
    else schedule(packages, form);
  };

  return { submit, isSubmitting: isInstalling || isUpdating || isScheduling };
}
