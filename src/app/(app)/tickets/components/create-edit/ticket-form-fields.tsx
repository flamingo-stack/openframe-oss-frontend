'use client';
'use no memo';

import {
  Autocomplete,
  FileUpload,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { AssignmentsField } from '@/components/assignments';
import { getFullImageUrl } from '@/lib/image-url';
import { nativeFilePicker, type UploadSource } from '@/lib/native-files';
import type { TicketPrefill } from '@/lib/routes';
import type { useTempAttachments } from '../../hooks/use-temp-attachments';
import {
  type AutocompleteOption,
  type AvatarOption,
  useDeviceOptions,
  useOrganizationOptions,
  useSelfFirstAssigneeOptions,
} from '../../hooks/use-ticket-options';
import { useTicketStatusesQuery } from '../../statuses/hooks/use-ticket-statuses-query';
import type { CreateTicketFormData } from '../../types/create-ticket.types';
import type { Ticket } from '../../types/ticket.types';
import { resolveCurrentStatus } from '../../utils/resolve-current-status';
import { isStatusLockedByPendingApproval, STATUS_LOCKED_BY_APPROVAL_REASON } from '../../utils/status-lock';
import { getTicketDeviceName } from '../../utils/ticket-device-name';
import { TICKET_STATUS_KIND } from '../../utils/ticket-statistics';
import { avatarStartAdornment, renderAvatarOption } from '../avatar-autocomplete';
import { renderStatusOption, type StatusOption, statusStartAdornment } from '../status-autocomplete';
import { MarkdownEditor, SimpleMarkdownRenderer } from './lazy-markdown';
import { TicketTagsManager } from './ticket-tags-manager';

const renderOrganizationOption = renderAvatarOption('square');
const renderAssigneeOption = renderAvatarOption('round');

/**
 * Pins one option into a fetched list. An Autocomplete renders the raw id for a
 * value its `options` lack, and every list here is a single page — the first 50
 * customers for an empty search, the customer's first 50 devices, the first 100
 * users — so the ticket's own customer/device/assignee, and whatever the user
 * just picked through a search that has since reset, are only in the list if
 * this puts them there.
 */
function withOption<T extends AutocompleteOption>(options: T[], extra: T | null): T[] {
  if (!extra || options.some(o => o.value === extra.value)) return options;
  return [extra, ...options];
}

interface TicketFormFieldsProps {
  form: UseFormReturn<CreateTicketFormData>;
  tempAttachments: ReturnType<typeof useTempAttachments>;
  isFaeForm?: boolean;
  isEditMode?: boolean;
  ticket?: Ticket;
  /** Create-mode starting values — their customer/device get pinned into the pickers like the ticket's own. */
  prefill?: TicketPrefill;
}

export function TicketFormFields({
  form,
  tempAttachments,
  isFaeForm = false,
  isEditMode = false,
  ticket,
  prefill,
}: TicketFormFieldsProps) {
  const { control, setValue } = form;

  const [orgSearch, setOrgSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const debouncedOrgSearch = useDebounce(orgSearch, 300);
  const debouncedDeviceSearch = useDebounce(deviceSearch, 300);

  // `useWatch`, not `form.watch`: a render-level `watch` re-renders the
  // `useForm` owner (the whole page) on every change of the field.
  const selectedOrgId = useWatch({ control, name: 'organizationId' });
  const selectedDeviceId = useWatch({ control, name: 'deviceId' });
  const lockOrgAndDevice = isEditMode && !!selectedDeviceId;
  const organizationOptions = useOrganizationOptions(debouncedOrgSearch);
  const deviceOptions = useDeviceOptions(selectedOrgId ?? undefined, debouncedDeviceSearch);
  const assigneeOptions = useSelfFirstAssigneeOptions();

  // See `withOption`: the ticket's own selections, and the ones picked through a
  // search, pinned into the page each list fetched.
  const [pickedOrg, setPickedOrg] = useState<AvatarOption | null>(null);
  const [pickedDevice, setPickedDevice] = useState<AutocompleteOption | null>(null);
  const ticketOrg = useMemo<AvatarOption | null>(() => {
    if (ticket?.organizationId) {
      return {
        value: ticket.organizationId,
        label: ticket.organizationName || ticket.organizationId,
        imageUrl: getFullImageUrl(ticket.organizationImage?.imageUrl, ticket.organizationImage?.hash),
      };
    }
    if (prefill?.organizationId) {
      return { value: prefill.organizationId, label: prefill.organizationName || prefill.organizationId };
    }
    return null;
  }, [ticket, prefill]);
  const ticketDevice = useMemo<AutocompleteOption | null>(() => {
    if (ticket?.deviceId) return { value: ticket.deviceId, label: getTicketDeviceName(ticket) || ticket.deviceId };
    if (prefill?.deviceId) return { value: prefill.deviceId, label: prefill.deviceName || prefill.deviceId };
    return null;
  }, [ticket, prefill]);
  const ticketAssignee = useMemo<AvatarOption | null>(() => {
    if (ticket?.assignedTo) {
      return {
        value: ticket.assignedTo,
        label: ticket.assignedName || ticket.assignedTo,
        imageUrl: getFullImageUrl(ticket.assigneeImage?.imageUrl, ticket.assigneeImage?.hash),
      };
    }
    if (prefill?.assigneeId) {
      return { value: prefill.assigneeId, label: prefill.assigneeName || prefill.assigneeId };
    }
    return null;
  }, [ticket, prefill]);
  const organizationOptionsList = useMemo(
    () => withOption(withOption(organizationOptions.options, pickedOrg), ticketOrg),
    [organizationOptions.options, pickedOrg, ticketOrg],
  );
  const deviceOptionsList = useMemo(
    () => withOption(withOption(deviceOptions.options, pickedDevice), ticketDevice),
    [deviceOptions.options, pickedDevice, ticketDevice],
  );
  const assigneeOptionsList = useMemo(
    () => withOption(assigneeOptions.options, ticketAssignee),
    [assigneeOptions.options, ticketAssignee],
  );

  const statusesQuery = useTicketStatusesQuery({ enabled: true });
  const statusOptions = useMemo<StatusOption[]>(() => {
    if (isEditMode) {
      const current = resolveCurrentStatus(ticket, statusesQuery.data?.snapshot);
      const transitions = ticket?.availableTransitions ?? [];
      const byId = new Map<string, StatusOption>();
      if (current) byId.set(current.id, { label: current.name, value: current.id, color: current.color });
      for (const t of transitions) byId.set(t.id, { label: t.name, value: t.id, color: t.color });
      return [...byId.values()];
    }
    // New ticket: custom statuses plus TECH_REQUIRED — the one system status the backend
    // allows tickets to be created in (createTicket rejects the other system statuses).
    return (statusesQuery.data?.snapshot ?? [])
      .filter(s => !s.isSystem || s.kind === TICKET_STATUS_KIND.TECH_REQUIRED)
      .map(s => ({ label: s.name, value: s.id, color: s.color }));
  }, [isEditMode, ticket, statusesQuery.data]);

  // Tech Required + pending approval: the server rejects any transition, so
  // the status field is locked with the reason in a tooltip.
  const isStatusLocked =
    isEditMode &&
    isStatusLockedByPendingApproval({
      statusKind: ticket?.statusDefinition?.kind,
      pendingApproval: ticket?.pendingApproval,
    });

  const selectedStatusId = useWatch({ control, name: 'statusId' });
  // New ticket: pre-select the first CUSTOM status once options load (Tech Required is
  // selectable but must not become the default).
  const defaultStatusId = statusesQuery.data?.customStatuses[0]?.id;
  useEffect(() => {
    if (!isEditMode && !selectedStatusId && defaultStatusId) {
      setValue('statusId', defaultStatusId);
    }
  }, [isEditMode, selectedStatusId, defaultStatusId, setValue]);
  const renderPreview = useCallback(
    (source: string) => (
      <div className="custom-preview-wrapper" style={{ height: '100%', overflow: 'auto' }}>
        <SimpleMarkdownRenderer content={source} />
      </div>
    ),
    [],
  );

  const handleFilesAdded = (files: UploadSource | UploadSource[] | undefined) => {
    if (!files) return;
    const fileArray = Array.isArray(files) ? files : [files];
    for (const file of fileArray) {
      tempAttachments.uploadFile(file);
    }
  };

  // Map 'existing' status to 'uploaded' for the FileUpload component
  const managedFiles = useMemo(
    () =>
      tempAttachments.files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        contentType: f.contentType,
        status: (f.status === 'existing' ? 'uploaded' : f.status) as 'uploading' | 'uploaded' | 'error',
        error: f.error,
      })),
    [tempAttachments.files],
  );

  return (
    <>
      {/* Title */}
      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <div>
            <Label className="text-ods-text-primary text-h4">Title</Label>
            <Input
              type="text"
              value={field.value}
              onChange={field.onChange}
              placeholder="Enter Ticket Name Here"
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
            />
          </div>
        )}
      />

      {/* Organization, Device, Assigned, Status — 4-column grid (2 on mobile) */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Controller
          name="organizationId"
          control={control}
          render={({ field, fieldState }) => {
            const selectedOrg = organizationOptionsList.find(o => o.value === field.value);
            return (
              <Autocomplete
                label="Customer"
                options={organizationOptionsList}
                value={field.value ?? null}
                onChange={val => {
                  setPickedOrg(organizationOptionsList.find(o => o.value === val) ?? null);
                  field.onChange(val);
                  // Clear, not `resetField`: once the form is seeded from a
                  // ticket, the field's default IS that ticket's device.
                  setValue('deviceId', null);
                  setPickedDevice(null);
                  setDeviceSearch('');
                }}
                onInputChange={setOrgSearch}
                placeholder="Select Customer"
                loading={organizationOptions.isLoading}
                disabled={isFaeForm || lockOrgAndDevice}
                disableClientFilter
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                startAdornment={avatarStartAdornment(selectedOrg, 'square')}
                renderOption={renderOrganizationOption}
              />
            );
          }}
        />

        <Controller
          name="deviceId"
          control={control}
          render={({ field, fieldState }) => (
            <Autocomplete
              label="Device"
              options={deviceOptionsList}
              value={field.value ?? null}
              onChange={val => {
                setPickedDevice(deviceOptionsList.find(o => o.value === val) ?? null);
                field.onChange(val);
              }}
              onInputChange={setDeviceSearch}
              placeholder={selectedOrgId ? 'Select Device' : 'Select Customer first'}
              loading={deviceOptions.isLoading}
              disabled={isFaeForm || !selectedOrgId || lockOrgAndDevice}
              disableClientFilter
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
            />
          )}
        />

        <Controller
          name="assignedTo"
          control={control}
          render={({ field }) => {
            const selectedAssignee = assigneeOptionsList.find(o => o.value === field.value);
            return (
              <Autocomplete
                label="Assigned"
                options={assigneeOptionsList}
                value={field.value ?? null}
                onChange={val => field.onChange(val)}
                placeholder="Select Assignee"
                loading={assigneeOptions.isLoading}
                startAdornment={avatarStartAdornment(selectedAssignee, 'round')}
                renderOption={renderAssigneeOption}
              />
            );
          }}
        />

        {/* Status — custom-status lifecycle */}
        <Controller
          name="statusId"
          control={control}
          render={({ field, fieldState }) => {
            const selectedStatus = statusOptions.find(o => o.value === field.value);
            const statusField = (
              <Autocomplete
                label="Status"
                options={statusOptions}
                value={field.value ?? null}
                onChange={val => field.onChange(val)}
                placeholder="Select Status"
                loading={!isEditMode && statusesQuery.isLoading}
                disabled={isFaeForm || isStatusLocked}
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                startAdornment={statusStartAdornment(selectedStatus)}
                renderOption={renderStatusOption}
              />
            );
            if (!isStatusLocked) return statusField;
            return (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-not-allowed">{statusField}</div>
                  </TooltipTrigger>
                  <TooltipContent>{STATUS_LOCKED_BY_APPROVAL_REASON}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }}
        />
      </div>

      {/* Tags */}
      <Controller
        name="tagIds"
        control={control}
        render={({ field }) => <TicketTagsManager selectedIds={field.value} onChange={val => field.onChange(val)} />}
      />

      {/* File Upload — managed mode with temp attachments */}
      <FileUpload
        onChange={handleFilesAdded}
        pickFiles={nativeFilePicker({ multiple: true })}
        managedFiles={managedFiles}
        onRemoveManagedFile={tempAttachments.removeFile}
        multiple
        label="Upload Files"
        description="(Click Here or Drag and Drop)"
      />

      {/* Description — Markdown Editor */}
      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <MarkdownEditor
            value={field.value}
            onChange={field.onChange}
            placeholder="Ticket Description"
            height={500}
            renderPreview={renderPreview}
            disabled={isFaeForm}
          />
        )}
      />

      <Controller
        name="assignments"
        control={control}
        render={({ field }) => (
          <AssignmentsField
            value={field.value ?? {}}
            onChange={field.onChange}
            // INSIGHT is not pickable: the row shows the incident the ticket is filed from (seeded from the prefill).
            enabledTypes={['ORGANIZATION', 'DEVICE', 'KNOWLEDGE_ARTICLE', 'INSIGHT']}
          />
        )}
      />
    </>
  );
}
