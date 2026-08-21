'use client';

import { Autocomplete, FileUpload, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { AssignmentsField } from '@/components/assignments';
import { nativeFilePicker, type UploadSource } from '@/lib/native-files';
import type { useTempAttachments } from '../../hooks/use-temp-attachments';
import { useDeviceOptions, useOrganizationOptions, useSelfFirstAssigneeOptions } from '../../hooks/use-ticket-options';
import { useTicketStatusesQuery } from '../../statuses/hooks/use-ticket-statuses-query';
import type { CreateTicketFormData } from '../../types/create-ticket.types';
import type { Ticket } from '../../types/ticket.types';
import { resolveCurrentStatus } from '../../utils/resolve-current-status';
import { TICKET_STATUS_KIND } from '../../utils/ticket-statistics';
import { avatarStartAdornment, renderAvatarOption } from '../avatar-autocomplete';
import { renderStatusOption, type StatusOption, statusStartAdornment } from '../status-autocomplete';
import { MarkdownEditor, SimpleMarkdownRenderer } from './lazy-markdown';
import { TicketTagsManager } from './ticket-tags-manager';

const renderOrganizationOption = renderAvatarOption('square');
const renderAssigneeOption = renderAvatarOption('round');

interface TicketFormFieldsProps {
  form: UseFormReturn<CreateTicketFormData>;
  tempAttachments: ReturnType<typeof useTempAttachments>;
  isFaeForm?: boolean;
  isEditMode?: boolean;
  ticket?: Ticket;
}

export function TicketFormFields({
  form,
  tempAttachments,
  isFaeForm = false,
  isEditMode = false,
  ticket,
}: TicketFormFieldsProps) {
  const { control, watch, resetField, setValue } = form;

  const [orgSearch, setOrgSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const debouncedOrgSearch = useDebounce(orgSearch, 300);
  const debouncedDeviceSearch = useDebounce(deviceSearch, 300);

  const selectedOrgId = watch('organizationId');
  const selectedDeviceId = watch('deviceId');
  const lockOrgAndDevice = isEditMode && !!selectedDeviceId;
  const organizationOptions = useOrganizationOptions(debouncedOrgSearch);
  const deviceOptions = useDeviceOptions(selectedOrgId ?? undefined, debouncedDeviceSearch);
  const assigneeOptions = useSelfFirstAssigneeOptions();
  const assigneeOptionsList = assigneeOptions.options;

  // The ticket's device may not be in the fetched page (large fleet / search), which would
  // leave the Autocomplete rendering the raw id. Seed it from the ticket's known hostname.
  const deviceOptionsList = useMemo(() => {
    const options = deviceOptions.options;
    const currentId = ticket?.deviceId;
    if (!currentId || options.some(o => o.value === currentId)) return options;
    return [{ label: ticket?.deviceHostname || currentId, value: currentId }, ...options];
  }, [deviceOptions.options, ticket?.deviceId, ticket?.deviceHostname]);

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

  const selectedStatusId = watch('statusId');
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
            <Label className="text-h4 text-ods-text-primary">Title</Label>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Controller
          name="organizationId"
          control={control}
          render={({ field, fieldState }) => {
            const selectedOrg = organizationOptions.options.find(o => o.value === field.value);
            return (
              <Autocomplete
                label="Customer"
                options={organizationOptions.options}
                value={field.value ?? null}
                onChange={val => {
                  field.onChange(val);
                  resetField('deviceId');
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
              onChange={val => field.onChange(val)}
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
            return (
              <Autocomplete
                label="Status"
                options={statusOptions}
                value={field.value ?? null}
                onChange={val => field.onChange(val)}
                placeholder="Select Status"
                loading={!isEditMode && statusesQuery.isLoading}
                disabled={isFaeForm}
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                startAdornment={statusStartAdornment(selectedStatus)}
                renderOption={renderStatusOption}
              />
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
            enabledTypes={['ORGANIZATION', 'DEVICE', 'KNOWLEDGE_ARTICLE']}
          />
        )}
      />
    </>
  );
}
