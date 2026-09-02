'use client';

import { PageLayout, ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import {
  CheckboxBlock,
  Input,
  Label,
  type PageActionButton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceSelector } from '@/app/components/shared/device-selector';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { RUN_SUMMARY_STATS, ScriptSummaryCardSkeleton } from './script-summary-card';

const noop = () => {};
const EMPTY_ARGUMENTS: never[] = [];
const EMPTY_SELECTION = new Set<string>();
const NO_DEVICES: never[] = [];

const ACTIONS: PageActionButton[] = [{ label: 'Run Script', variant: 'accent', disabled: true }];

/**
 * The "Run Script" page while its script query is in flight: the real controls
 * in their disabled state, so nothing moves when the script lands.
 */
export function RunScriptSkeleton({ scriptId }: { scriptId: string }) {
  const handleBack = useSafeBack(routes.scripts.details(scriptId));

  return (
    <PageLayout
      title="Run Script"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={ACTIONS}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {/* Same 3 stats as the loaded card (`showTimeout` is off on the run page). */}
      <ScriptSummaryCardSkeleton stats={RUN_SUMMARY_STATS} />

      <div className="grid grid-cols-1 items-end gap-[var(--spacing-system-lf)] lg:grid-cols-2">
        <div>
          <Label className="text-ods-text-primary text-h3">Timeout</Label>
          <Input
            type="number"
            className="w-full"
            value=""
            onChange={noop}
            disabled
            endAdornment={<span className="text-ods-text-secondary text-h6">Seconds</span>}
          />
        </div>
        <CheckboxBlock checked={false} onCheckedChange={noop} label="Run as User" disabled />
      </div>

      <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] lg:grid-cols-2">
        <ScriptArguments
          arguments={EMPTY_ARGUMENTS}
          onArgumentsChange={noop}
          keyPlaceholder="Key"
          valuePlaceholder="Enter Value (empty=flag)"
          addButtonLabel="Add Script Argument"
          titleLabel="Script Arguments"
          disabled
        />
        <ScriptArguments
          arguments={EMPTY_ARGUMENTS}
          onArgumentsChange={noop}
          keyPlaceholder="Key"
          valuePlaceholder="Enter Value"
          addButtonLabel="Add Environment Var"
          titleLabel="Environment Vars"
          disabled
        />
      </div>

      <div className="space-y-[var(--spacing-system-xxs)]">
        <DeviceSelector
          devices={NO_DEVICES}
          loading
          selectedIds={EMPTY_SELECTION}
          getDeviceKey={() => ''}
          onSelectionChange={noop}
          showSelectionModeRadio={false}
          addAllBehavior="replace"
        />
      </div>
    </PageLayout>
  );
}
