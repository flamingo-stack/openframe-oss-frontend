'use client';
'use no memo';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { CommandBox } from '@flamingo-stack/openframe-frontend-core/components/features';
import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  Autocomplete,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { DEFAULT_OS_PLATFORM, type OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { OrgAvatar } from '@/app/components/shared';
import { OsPlatformSelector } from '@/app/components/shared/os-platform-selector';
import { isValidTag, type TagEntryWithId, TagsEditor } from '@/app/components/shared/tags';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '@/lib/platforms';
import { routes } from '@/lib/routes';
import { AdminPrivilegesWarning } from '../components/admin-privileges-warning';
import { AntivirusWarning } from '../components/antivirus-warning';
import { DoctorModeWarning } from '../components/doctor-mode-warning';
import { useDeviceOrganizations } from '../hooks/use-device-organizations';
import { useInstallCommand } from '../hooks/use-install-command';
import {
  type InstallMethod,
  installMethodLabel,
  installMethodsForPlatform,
  isInstallMethodEnabled,
  PACKAGE_MANAGER_METHODS,
} from '../utils/device-command-utils';

const newDeviceSchema = z.object({
  organizationId: z.string().min(1, 'Customer is required'),
  platform: z.custom<OSPlatformId>(),
  installMethod: z.custom<InstallMethod>(),
});

type NewDeviceFormValues = z.infer<typeof newDeviceSchema>;

export function NewDeviceContent() {
  const handleBack = useSafeBack(routes.devices.list);
  const { toast } = useToast();

  // Customer context passed by "Add Device" launched from a customer's section
  // (e.g. `/devices/new?organizationId=<id>`), used to pre-select the dropdown.
  const preselectedOrgId = useSearchParams().get('organizationId');

  // Organizations for the customer dropdown (GraphQL via TanStack Query).
  const orgs = useDeviceOrganizations(100);

  const [tags, setTags] = useState<TagEntryWithId[]>([]);

  const form = useForm<NewDeviceFormValues>({
    resolver: zodResolver(newDeviceSchema),
    defaultValues: { organizationId: '', platform: DEFAULT_OS_PLATFORM, installMethod: 'script' },
  });

  const organizationId = useWatch({ control: form.control, name: 'organizationId' });
  const platform = useWatch({ control: form.control, name: 'platform' });
  const installMethod = useWatch({ control: form.control, name: 'installMethod' });

  const validTags = useMemo(() => {
    const seen = new Set<string>();
    return tags.flatMap(t => {
      if (!t.key || !isValidTag(t.key)) return [];
      if (seen.has(t.key)) return [];
      const validValues = t.values.filter(isValidTag);
      if (validValues.length === 0) return [];
      seen.add(t.key);
      return [{ ...t, values: validValues }];
    });
  }, [tags]);

  const { command, registerCommand, initialKey } = useInstallCommand({ organizationId, platform, tags: validTags });

  const orgOptions: AutocompleteOption[] = useMemo(
    () => orgs.map(o => ({ label: o.name, value: o.organizationId })),
    [orgs],
  );

  const selectedOrg = orgs.find(o => o.organizationId === organizationId);

  // Set the initial org once data loads. Prefer the customer passed via the
  // `organizationId` query param (Add Device launched from a customer's
  // section); fall back to the default organization, then the first one.
  useEffect(() => {
    if (orgs.length > 0 && !organizationId) {
      const preselected = preselectedOrgId ? orgs.find(o => o.organizationId === preselectedOrgId) : undefined;
      const defaultOrg = preselected ?? orgs.find(o => o.isDefault) ?? orgs[0];
      if (defaultOrg) form.setValue('organizationId', defaultOrg.organizationId);
    }
  }, [orgs, organizationId, form, preselectedOrgId]);

  const validateBeforeAction = useCallback(async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast({ title: 'Validation error', description: 'Please select a customer', variant: 'destructive' });
      return false;
    }
    if (!initialKey) {
      toast({ title: 'Secret unavailable', description: 'Registration secret not loaded yet', variant: 'destructive' });
      return false;
    }
    const filledTags = tags.filter(t => t.key);
    const hasInvalidTags = filledTags.some(t => !isValidTag(t.key) || t.values.some(v => !isValidTag(v)));
    if (hasInvalidTags) {
      toast({
        title: 'Invalid tags',
        description: 'Tag keys and values can only contain letters, numbers, underscores, hyphens, and dots',
        variant: 'destructive',
      });
      return false;
    }
    const keys = filledTags.map(t => t.key);
    if (new Set(keys).size !== keys.length) {
      toast({
        title: 'Duplicate tags',
        description: 'Each tag key must be unique. Please remove duplicate tags.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [form, initialKey, tags, toast]);

  const { copy: doCopy, copied: commandCopied } = useCopyToClipboard({
    successDescription: 'Command copied to clipboard',
    errorDescription: 'Could not copy command',
  });

  const copyCommand = useCallback(async () => {
    if (!(await validateBeforeAction())) return;
    if (installMethod === 'script') {
      doCopy(command);
      return;
    }
    // Both steps in one paste: install through the package manager, then
    // enroll. Windows chains with ';' — the stock Windows PowerShell 5.1 the
    // admin warning points users at has no '&&'. macOS keeps '&&' so
    // registration only runs after a successful install.
    const separator = platform === 'windows' ? '; ' : ' && ';
    doCopy(`${PACKAGE_MANAGER_METHODS[installMethod].installCommand}${separator}${registerCommand}`);
  }, [command, registerCommand, installMethod, platform, doCopy, validateBeforeAction]);

  // Corner copy buttons take their own clipboard hook so the main button's
  // "copied" checkmark doesn't light up for a box-level copy.
  const { copy: copyBoxCommand } = useCopyToClipboard({
    successDescription: 'Command copied to clipboard',
    errorDescription: 'Could not copy command',
  });

  const copyInstallScript = useCallback(async () => {
    if (!(await validateBeforeAction())) return;
    copyBoxCommand(command);
  }, [command, copyBoxCommand, validateBeforeAction]);

  const copyRegisterCommand = useCallback(async () => {
    if (!(await validateBeforeAction())) return;
    copyBoxCommand(registerCommand);
  }, [registerCommand, copyBoxCommand, validateBeforeAction]);

  return (
    <PageLayout
      title="New Device"
      backButton={{ label: 'Back', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Controller
            name="organizationId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Autocomplete
                options={orgOptions}
                value={field.value || null}
                onChange={val => field.onChange(val ?? '')}
                label="Select Customer"
                labelVariant="large"
                placeholder="Choose customer"
                loading={false}
                error={fieldState.error?.message}
                startAdornment={
                  selectedOrg ? (
                    <span className="group-has-[:focus]:hidden">
                      <OrgAvatar imageUrl={selectedOrg.imageUrl} hash={selectedOrg.imageHash} name={selectedOrg.name} />
                    </span>
                  ) : undefined
                }
                renderOption={option => {
                  const org = orgs.find(o => o.organizationId === option.value);
                  return (
                    <div className="flex w-full min-w-0 items-center gap-2">
                      <OrgAvatar imageUrl={org?.imageUrl} hash={org?.imageHash} name={org?.name ?? option.label} />
                      <div className="min-w-0 flex-1">
                        <TruncateText className="text-current">{option.label}</TruncateText>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          />
          <Controller
            name="platform"
            control={form.control}
            render={({ field }) => (
              <OsPlatformSelector
                value={field.value}
                onValueChange={platformId => {
                  field.onChange(platformId);
                  // Winget/Chocolatey exist only on Windows, Brew only on macOS.
                  if (!installMethodsForPlatform(platformId).includes(form.getValues('installMethod'))) {
                    form.setValue('installMethod', 'script');
                  }
                }}
                label="Select Platform"
                disabledPlatforms={DISABLED_PLATFORMS}
                options={AVAILABLE_PLATFORMS.map(p => ({ platformId: p.id }))}
              />
            )}
          />
          <Controller
            name="installMethod"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger label="Install Method" labelVariant="large">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {installMethodsForPlatform(platform).map(method => (
                    <SelectItem key={method} value={method} disabled={!isInstallMethodEnabled(method)}>
                      {installMethodLabel(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <TagsEditor tags={tags} onTagsChange={setTags} addLabel="Add Device Tag" />

        <div className="flex flex-col gap-[var(--spacing-system-m)]">
          {installMethod === 'script' ? (
            <CommandBox
              title="OpenFrame Installation Script"
              command={command}
              onCopy={copyInstallScript}
              copyAriaLabel="Copy installation script"
            />
          ) : (
            <>
              <CommandBox
                title={PACKAGE_MANAGER_METHODS[installMethod].commandTitle}
                command={PACKAGE_MANAGER_METHODS[installMethod].installCommand}
                onCopy={() => copyBoxCommand(PACKAGE_MANAGER_METHODS[installMethod].installCommand)}
                copyAriaLabel="Copy install command"
              />
              <CommandBox
                title="OpenFrame Register Command"
                command={registerCommand}
                onCopy={copyRegisterCommand}
                copyAriaLabel="Copy register command"
              />
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="small"
            className="self-end"
            onClick={copyCommand}
            leftIcon={
              commandCopied ? <CheckIcon className="h-5 w-5 text-ods-success" /> : <Copy02Icon className="h-5 w-5" />
            }
          >
            {installMethod === 'script' ? 'Copy Install Command' : 'Copy Install & Register Command'}
          </Button>
        </div>

        <AdminPrivilegesWarning platform={platform} />
        <AntivirusWarning platform={platform} />
        <DoctorModeWarning platform={platform} />
      </div>
    </PageLayout>
  );
}
