'use client';

import { ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  CheckboxBlock,
  Input,
  Label,
  type PageActionButton,
  Skeleton,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceSelector } from '@/app/components/shared/device-selector';
import { EntityTagPickerFallback } from '@/app/components/shared/tags';
import { routes } from '@/lib/routes';
import { ExecutionsSkeleton } from './executions-table';
import { DETAIL_TABS, ScriptDetailsTabSkeleton, ScriptHeaderSkeleton } from './script-details-view';
import { ScriptPageChrome } from './script-page-chrome';
import { RUN_SUMMARY_LABELS, ScriptSummaryCardSkeleton } from './script-summary-card';

/**
 * Route-level skeletons for the scripts-v2 detail surfaces.
 *
 * All three render through the REAL `ScriptPageChrome` and the REAL loading
 * pieces each page already uses (`ScriptHeaderSkeleton`,
 * `ScriptDetailsTabSkeleton`, `ScriptSummaryCardSkeleton`, `DeviceSelector` in
 * `loading` mode), so the app-shell placeholder IS the page's own loading state
 * — the cold start no longer shows a generic skeleton before it.
 */

const noop = () => {};
const EMPTY_ARGUMENTS: never[] = [];
const EMPTY_SELECTION = new Set<string>();
const NO_DEVICES: never[] = [];

// ----------------------------------------------------------------
// /scripts-v2/details
// ----------------------------------------------------------------

const DETAILS_ACTIONS: PageActionButton[] = [
  {
    label: 'Run Script',
    variant: 'accent',
    disabled: true,
    iconAction: {
      icon: <ArrowRightUpIcon className="w-5 h-5" />,
      'aria-label': 'Open Run Script in new tab',
      onClick: noop,
    },
  },
];

export function ScriptDetailsPageSkeleton({ tab }: { tab?: string }) {
  const activeTab = tab === 'executions' ? 'executions' : 'details';

  return (
    <ScriptPageChrome
      title="Script Details"
      backFallback={routes.scriptsV2.list}
      actions={DETAILS_ACTIONS}
      actionsVariant="menu-primary"
    >
      {/* `inert` on THIS element, not a wrapper around `TabNavigation`: that
          component returns a fragment whose tab bar and tab body are siblings,
          so wrapping it would collapse two flex items into one and drop the gap
          between them. `inert` also does what `pointer-events-none` alone could
          not — the tab triggers are real `<button>`s, so they stayed keyboard-
          focusable and screen-reader-reachable while doing nothing. It removes
          the whole placeholder subtree from the a11y tree and the tab order;
          the header's Back button sits outside it and stays usable. */}
      <div className="flex flex-col gap-[var(--spacing-system-lf)]" inert>
        <ScriptHeaderSkeleton />
        {/* The REAL tab bar (not a copy) — `urlSync` is off so rendering the
            skeleton can't rewrite the URL. `pointer-events-none` is kept as a
            mouse-only fallback for browsers without `inert`. */}
        <TabNavigation tabs={DETAIL_TABS} activeTab={activeTab} onTabChange={noop} className="pointer-events-none">
          {() => (activeTab === 'executions' ? <ExecutionsSkeleton /> : <ScriptDetailsTabSkeleton />)}
        </TabNavigation>
      </div>
    </ScriptPageChrome>
  );
}

// ----------------------------------------------------------------
// /scripts-v2/details/run
// ----------------------------------------------------------------

const RUN_ACTIONS: PageActionButton[] = [{ label: 'Run Script', variant: 'accent', disabled: true }];

export function RunScriptPageSkeleton() {
  return (
    <ScriptPageChrome title="Run Script" backFallback={routes.scriptsV2.list} actions={RUN_ACTIONS}>
      <ScriptSummaryCardSkeleton labels={RUN_SUMMARY_LABELS} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--spacing-system-lf)] items-end">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--spacing-system-lf)]">
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
    </ScriptPageChrome>
  );
}

// ----------------------------------------------------------------
// /scripts-v2/edit and /scripts-v2/new
// ----------------------------------------------------------------

const EDIT_ACTIONS: PageActionButton[] = [
  { label: 'Test Script', variant: 'outline', disabled: true },
  { label: 'Save Script', variant: 'accent', disabled: true },
];

const PLATFORM_CARD_KEYS = ['windows', 'darwin', 'linux', 'run-as-user'] as const;
const FIELD_KEYS = ['name', 'shell', 'timeout'] as const;

/**
 * Mirrors `ScriptFormFields` as `EditScriptPage` renders it: the platform picker
 * row, the field grid (Name / Shell Type / Timeout — Category is hidden on v2),
 * Description, the tag picker, the two argument blocks and the Monaco editor.
 * The editor is a plain block on purpose — mounting Monaco for a placeholder
 * costs more than the fidelity is worth.
 */
export function EditScriptPageSkeleton({ mode = 'edit' }: { mode?: 'edit' | 'new' }) {
  return (
    <ScriptPageChrome
      title={mode === 'new' ? 'New Script' : 'Edit Script'}
      backFallback={routes.scriptsV2.list}
      actions={EDIT_ACTIONS}
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
    </ScriptPageChrome>
  );
}
