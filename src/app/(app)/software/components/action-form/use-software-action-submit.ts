'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fetchQuery, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useSoftwareActionSubmitActionQuery as ActionQueryType } from '@/__generated__/useSoftwareActionSubmitActionQuery.graphql';
import type { useSoftwareActionSubmitMutation as SubmitMutationType } from '@/__generated__/useSoftwareActionSubmitMutation.graphql';
import {
  applyTimeSlot,
  isScheduleStartInPast,
  PAST_START_MESSAGE,
  toScheduleInstant,
} from '@/app/(app)/scripts/schedule/utils/schedule-timing';
import type { ScheduleTimeReference, SoftwareAction } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { type PackageInput, type SoftwareRow, toPackageInputs } from './software-row';

/**
 * Runs the draft now (`schedule: null`) or creates a software schedule from it,
 * and marks it COMPLETED. The server validates the whole bundle — devices,
 * packages, start time — so a rejection reads back as one message.
 *
 * `executionIds` is one per dispatched package. It is NOT a Software Action's
 * id: a run's row is aggregated from the executions its devices report, so it
 * exists only once the first device has picked the job up — immediately for an
 * online device, on reconnect for an offline one. See `actionQuery`.
 */
const submitMutation = graphql`
  mutation useSoftwareActionSubmitMutation($input: SubmitSoftwareBundleInput!) {
    submitSoftwareBundle(input: $input) {
      id
      executionIds
    }
  }
`;

/**
 * Whether a run's row exists yet, by its execution id — which `softwareAction`
 * accepts alongside a row's own id. Read at the moment of the answer: a row
 * that is there gets the user, by the id the Software Actions table links by;
 * one that is not yet leaves them on the list, where it appears as soon as a
 * device reports.
 */
const actionQuery = graphql`
  query useSoftwareActionSubmitActionQuery($id: ID!) {
    softwareAction(id: $id) {
      id
    }
  }
`;

export type RunMode = 'now' | 'schedule';

export interface SoftwareActionForm {
  rows: SoftwareRow[];
  /** The draft behind the page — null until the first device is assigned. */
  bundleId: string | null;
  /** How many devices the draft holds; the server refuses an empty one too. */
  deviceCount: number;
  mode: RunMode;
  date: Date | null;
  time: string;
  timeReference: ScheduleTimeReference;
}

interface SoftwareActionSubmitOptions {
  /** The draft is the run's history now — the page must stop treating it as one to discard. */
  onSubmitted: () => void;
}

interface SoftwareActionSubmit {
  submit: (form: SoftwareActionForm) => void;
  isSubmitting: boolean;
}

/** The page's submit: validates what the server would reject anyway, then submits the draft. */
export function useSoftwareActionSubmit(
  action: SoftwareAction,
  { onSubmitted }: SoftwareActionSubmitOptions,
): SoftwareActionSubmit {
  const copy = SOFTWARE_ACTION_COPY[action];
  const router = useRouter();
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const [commitSubmit, isSubmitting] = useMutation<SubmitMutationType>(submitMutation);
  // The submit has answered but the page has not left yet: the button stays
  // busy through the lookup that decides where to, rather than re-arming.
  const [isLeaving, setLeaving] = useState(false);

  const fail = (title: string, description: string) => {
    toast({ title, description, variant: 'destructive' });
  };

  const scheduleInput = (packages: PackageInput[], form: SoftwareActionForm) => {
    const { date, time, timeReference } = form;
    if (!date || !time) {
      fail('No start time', 'Pick a date and time for the schedule.');
      return null;
    }
    if (isScheduleStartInPast(date, time, timeReference)) {
      fail('Invalid start time', PAST_START_MESSAGE);
      return null;
    }
    return {
      name: `${copy.verb} ${packages.map(pkg => pkg.packageName).join(', ')}`,
      timeReference,
      startAt: toScheduleInstant(applyTimeSlot(date, time), timeReference),
    };
  };

  /** One run of one package: its page if the row exists by now, the list otherwise. */
  const leaveForRun = (executionId: string) => {
    setLeaving(true);
    fetchQuery<ActionQueryType>(
      environment,
      actionQuery,
      { id: executionId },
      { fetchPolicy: 'network-only' },
    ).subscribe({
      next: data => {
        router.push(data.softwareAction ? routes.software.action(data.softwareAction.id) : routes.software.actions);
      },
      // The run started either way; the list is where it will show up.
      error: () => router.push(routes.software.actions),
    });
  };

  const submit = (form: SoftwareActionForm) => {
    const packages = toPackageInputs(form.rows);
    if (!packages) {
      fail('No software selected', 'Pick a package in every row, or remove the empty ones.');
      return;
    }
    if (!form.bundleId || form.deviceCount === 0) {
      fail('No devices selected', 'Please select at least one device.');
      return;
    }
    const schedule = form.mode === 'schedule' ? scheduleInput(packages, form) : null;
    if (form.mode === 'schedule' && !schedule) return;

    const bundleId = form.bundleId;
    const { deviceCount } = form;
    commitSubmit({
      variables: { input: { id: bundleId, action, packages, schedule } },
      onCompleted: response => {
        onSubmitted();
        if (schedule) {
          toast({ title: copy.scheduled, description: 'It will run at the scheduled time.', variant: 'success' });
          router.push(routes.software.actions);
          return;
        }
        const runs = response.submitSoftwareBundle.executionIds ?? [];
        toast({
          title: copy.started,
          description: `${packages.length === 1 ? packages[0].packageName : pluralize(packages.length, 'package')} on ${pluralize(deviceCount, 'device')}.`,
          variant: 'success',
        });
        if (runs.length === 1 && packages.length === 1) leaveForRun(runs[0]);
        else router.push(routes.software.actions);
      },
      onError: error => fail('Error', getRelayErrorMessage(error, copy.failed)),
    });
  };

  return { submit, isSubmitting: isSubmitting || isLeaving };
}
