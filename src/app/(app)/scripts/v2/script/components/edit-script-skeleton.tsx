'use client';

import { PageLayout, ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import { Label, type PageActionButton, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EntityTagPickerFallback } from '@/app/components/shared/tags';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

const noop = () => {};
const EMPTY_ARGUMENTS: never[] = [];

const ACTIONS: PageActionButton[] = [
  { label: 'Test Script', variant: 'outline', disabled: true },
  { label: 'Save Script', variant: 'accent', disabled: true },
];

const PLATFORM_CARD_KEYS = ['windows', 'darwin', 'linux', 'run-as-user'] as const;
const FIELD_KEYS = ['name', 'shell', 'timeout'] as const;

/**
 * Mirrors `ScriptFormFields` as the edit page renders it: the platform picker
 * row, the field grid (Name / Shell Type / Timeout — Category is hidden on v2),
 * Description, the tag picker, the two argument blocks and the Monaco editor.
 * The editor is a plain block on purpose — mounting Monaco for a placeholder
 * costs more than the fidelity is worth. The create page needs none of this: it
 * has no record to wait for.
 */
export function EditScriptSkeleton({ scriptId }: { scriptId: string }) {
  const handleBack = useSafeBack(routes.scriptsV2.details(scriptId));

  return (
    <PageLayout
      title="Edit Script"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={ACTIONS}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div>
        <Label className="text-h4 text-ods-text-primary">Supported Platform</Label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--spacing-system-mf)] mt-[var(--spacing-system-xxs)]">
          {PLATFORM_CARD_KEYS.map(key => (
            <Skeleton key={key} className="h-11 md:h-16 rounded-md" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--spacing-system-lf)]">
        {FIELD_KEYS.map(key => (
          <div key={key} className="space-y-[var(--spacing-system-xxs)]">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ))}
      </div>

      <div>
        <Label className="text-h4 text-ods-text-primary">Description</Label>
        <Skeleton className="h-24 w-full rounded-md" />
      </div>

      <EntityTagPickerFallback />

      <div className="flex flex-col lg:flex-row gap-[var(--spacing-system-lf)]">
        <ScriptArguments
          arguments={EMPTY_ARGUMENTS}
          onArgumentsChange={noop}
          keyPlaceholder="Enter Argument"
          valuePlaceholder="Enter Value (empty=flag)"
          addButtonLabel="Add Script Argument"
          titleLabel="Script Arguments"
          disabled
          className="flex-1"
        />
        <ScriptArguments
          arguments={EMPTY_ARGUMENTS}
          onArgumentsChange={noop}
          keyPlaceholder="Enter Environment Var"
          valuePlaceholder="Enter Value"
          addButtonLabel="Add Environment Var"
          titleLabel="Environment Vars"
          disabled
          className="flex-1"
        />
      </div>

      <div>
        <Label className="text-h4 text-ods-text-primary">Syntax</Label>
        <Skeleton className="h-[300px] lg:h-[600px] w-full rounded-md" />
      </div>
    </PageLayout>
  );
}
