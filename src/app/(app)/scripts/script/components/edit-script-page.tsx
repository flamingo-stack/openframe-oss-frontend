'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useLazyLoadQuery, useMutation } from 'react-relay';
import type { runCommandMutation as RunCommandMutationType } from '@/__generated__/runCommandMutation.graphql';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import { EntityTagPicker, EntityTagPickerFallback } from '@/app/components/shared/tags';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { TagEntityType } from '@/generated/schema-enums';
import { runCommandMutation } from '@/graphql/scripts/run-command-mutation';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import type { EditScriptFormData } from '../../shared/types/edit-script.types';
import { relayScriptToForm, shellToEnum } from '../../shared/utils/script-mappers';
import { SCRIPT_SHELL_TYPES } from '../../shared/utils/shell-types';
import { useEditScriptForm } from '../hooks/use-edit-script-form';
import type { ScriptDetailData } from '../types/script-detail.types';
import { ExecutionStartedModal } from './execution-started-modal';
import { ScriptFormFields } from './script-form-fields';
import { type SelectedTestDevice, TestScriptModal } from './test-script-modal';

interface ScriptTag {
  id: string;
  key: string;
}

const NO_TAGS: ReadonlyArray<ScriptTag> = [];
const NO_PLATFORMS: string[] = [];

interface ScriptFieldsProps {
  form: UseFormReturn<EditScriptFormData>;
  showErrors: boolean;
  /**
   * Locks every control. This is what the page looks like while the script is in
   * flight: the real fields, in the exact geometry they will keep, with nothing
   * in them yet — so there is no placeholder to swap and the editor mounts once.
   */
  disabled?: boolean;
  /** The script's own tags, so the picker paints them before its own query lands. */
  initialTags?: ReadonlyArray<ScriptTag>;
}

/**
 * The form fields, v2-configured — one place for both the create page and the
 * edit page, and for the edit page's loading state, which is this same tree with
 * `disabled` on.
 *
 * The tag picker keeps its OWN boundary: the tag list is a second query, and it
 * has no reason to hold up the field it sits between.
 */
function ScriptFields({ form, showErrors, disabled = false, initialTags = NO_TAGS }: ScriptFieldsProps) {
  return (
    <ScriptFormFields
      form={form}
      shellTypes={SCRIPT_SHELL_TYPES}
      hideCategory
      showErrors={showErrors}
      disabled={disabled}
      tagsField={
        <Controller
          name="tag_ids"
          control={form.control}
          render={({ field }) => (
            <Suspense fallback={<EntityTagPickerFallback />}>
              <EntityTagPicker
                entityType={TagEntityType.SCRIPT}
                selectedIds={field.value}
                onChange={field.onChange}
                initialTags={initialTags}
                deletable
                disabled={disabled}
                entityLabel="script"
              />
            </Suspense>
          )}
        />
      }
    />
  );
}

/** What the page knows about the record it is editing. */
type ScriptRecordState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; values: EditScriptFormData | null; tags: ReadonlyArray<ScriptTag> };

const RECORD_LOADING: ScriptRecordState = { status: 'loading' };
/** The create page owns no record: nothing to seed, and the form is live at once. */
const RECORD_NOT_NEEDED: ScriptRecordState = { status: 'ready', values: null, tags: NO_TAGS };

interface ScriptRecordLoaderProps {
  scriptId: string;
  onResolved: (state: ScriptRecordState) => void;
}

/**
 * The page's data island — and it renders NOTHING.
 *
 * Everything it feeds is already on screen: the form is mounted from the first
 * render and simply locked, so the island has no placeholder to stand in for
 * (`fallback={null}`) and no fields to remount when the answer lands. It reads
 * the script and hands it up; the page writes it into the form (see
 * `useSeedForm` for why the WRITE cannot happen here).
 *
 * The alternative — the fields inside the boundary and a skeleton in the
 * fallback — costs a full remount of the field column on arrival, the editor
 * included, and a second copy of the form's markup to keep in step.
 */
function ScriptRecordLoader({ scriptId, onResolved }: ScriptRecordLoaderProps) {
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-and-network' },
  );
  const script: ScriptDetailData | null = data.script;

  const values = useMemo(() => (script ? relayScriptToForm(script) : null), [script]);
  const tags = useMemo(() => script?.tags?.map(t => ({ id: t.id, key: t.key })) ?? NO_TAGS, [script]);

  // Layout effect: the page seeds and unlocks the fields before the paint, so a
  // script Relay already had in its store is simply there.
  useLayoutEffect(() => {
    onResolved(values ? { status: 'ready', values, tags } : { status: 'missing' });
  }, [values, tags, onResolved]);

  return null;
}

/**
 * The page around the fields: the title, the Back button, the action bar and the
 * form instance itself. None of it reads the script, so all of it paints on the
 * first render and none of it is ever replaced by a placeholder.
 */
function EditScriptForm({ scriptId }: { scriptId: string | null }) {
  const isEditMode = Boolean(scriptId);
  const { toast } = useToast();
  const handleBack = useSafeBack(scriptId ? routes.scripts.details(scriptId) : routes.scripts.list);

  const { form, isSubmitting, handleSave } = useEditScriptForm({ scriptId, isEditMode });

  // ONLY Save reveals inline errors. The form validates on every change, but
  // painting a half-filled form red before the user has claimed to be done is
  // premature — Test reports its own missing prerequisites in a toast instead.
  const [showErrors, setShowErrors] = useState(false);

  // Nothing to wait for when creating. When editing, the loader below reports in
  // as soon as the script is there; until then the fields are locked, and so are
  // Save and Test — they would otherwise act on an empty form and answer a page
  // that is still loading with complaints about fields nobody has seen.
  const [record, setRecord] = useState<ScriptRecordState>(isEditMode ? RECORD_LOADING : RECORD_NOT_NEEDED);
  const isRecordReady = record.status === 'ready';

  // Seeded HERE rather than in the island that fetched it: this is the component
  // that owns the form, so its layout effect runs after every field below has
  // subscribed. See `useSeedForm`.
  useSeedForm(form, record.status === 'ready' ? record.values : null);

  // The platforms as of the moment Test was pressed — the picker filters devices
  // by them, and their presence is also what holds the modal open. Captured
  // rather than watched: a `watch` at this level would re-render the whole page
  // on every platform toggle.
  const [testPlatforms, setTestPlatforms] = useState<string[] | null>(null);
  const [testDispatched, setTestDispatched] = useState(false);
  const [commitRunCommand] = useMutation<RunCommandMutationType>(runCommandMutation);

  const handleSaveClick = useCallback(() => {
    setShowErrors(true);
    handleSave();
  }, [handleSave]);

  const closeTestModal = useCallback(() => setTestPlatforms(null), []);

  // The test (runCommand) only needs a shell, a non-empty body and at least one
  // platform (so the device picker has candidates). timeout / privilege have
  // defaults. Validate these BEFORE opening the device picker so the user is
  // never sent through device selection only to hit a dead-end.
  //
  // `shell` and `script_body` are validated via the resolver (`trigger`) so their
  // errors and clearing are fully owned by RHF — the form runs in `onChange`
  // mode, so the red state disappears the moment the field becomes valid.
  const validateTestPrereqs = useCallback(async () => {
    // Trigger every runnable prerequisite (incl. platforms) so each sets/clears its
    // own inline error via the resolver — Save's full-schema validation is a superset.
    const [shellOk, bodyOk, platformsOk] = await Promise.all([
      form.trigger('shell'),
      form.trigger('script_body'),
      form.trigger('supported_platforms'),
    ]);

    const missing: string[] = [];
    if (!shellOk) {
      missing.push('a shell type');
    }
    if (!bodyOk) {
      missing.push('script content');
    }
    if (!platformsOk) {
      missing.push('a supported platform');
    }

    if (missing.length > 0) {
      toast({
        title: 'Cannot test yet',
        description: `Add ${missing.join(', ')} before testing the script.`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [form, toast]);

  const handleOpenTest = useCallback(async () => {
    // Deliberately does NOT flip `showErrors`: Test is not a save attempt, and
    // its own toast already names what is missing. The `trigger` calls inside
    // still run — they keep RHF's error state current for the eventual Save.
    if (await validateTestPrereqs()) {
      setTestPlatforms(form.getValues('supported_platforms'));
    }
  }, [validateTestPrereqs, form]);

  const handleDeviceSelected = useCallback(
    async (device: SelectedTestDevice) => {
      // Prereqs were validated before the picker opened; re-check defensively in
      // case the form changed while it was open.
      if (!(await validateTestPrereqs())) {
        setTestPlatforms(null);
        return;
      }
      const values = form.getValues();

      commitRunCommand({
        variables: {
          input: {
            machineId: device.machineId,
            shell: shellToEnum(values.shell),
            command: values.script_body,
            privilegeLevel: values.run_as_user ? 'USER' : 'ADMIN',
            timeoutSeconds: values.default_timeout,
          },
        },
        onCompleted: () => setTestDispatched(true),
        onError: err => {
          toast({
            title: 'Test failed',
            description: getRelayErrorMessage(err, 'Failed to dispatch test'),
            variant: 'destructive',
          });
        },
      });
    },
    [form, commitRunCommand, toast, validateTestPrereqs],
  );

  // Test always dispatches `runCommand` (the current editor body may be unsaved),
  // so it carries no scriptId and never shows in `scriptExecutions(scriptId)` — the
  // results live in the activity logs, NOT the script's Execution History. Open in a
  // new tab so the user doesn't lose in-progress script edits.
  const handleViewLogs = useCallback(() => {
    setTestDispatched(false);
    window.open('/logs-page', '_blank', 'noopener,noreferrer');
  }, []);

  const actions = useMemo<PageActionButton[]>(
    () => [
      { label: 'Test Script', onClick: handleOpenTest, variant: 'outline' as const, disabled: !isRecordReady },
      {
        label: 'Save Script',
        onClick: handleSaveClick,
        variant: 'accent' as const,
        disabled: !isRecordReady || isSubmitting,
        loading: isSubmitting,
      },
    ],
    [handleSaveClick, isSubmitting, handleOpenTest, isRecordReady],
  );

  return (
    <>
      <PageLayout
        title={isEditMode ? 'Edit Script' : 'New Script'}
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={actions}
        // Form page: on mobile the actions belong in the fixed bottom bar, in
        // reach of the thumb — not folded into the header's "..." menu. Test +
        // Save already fill that bar, so no separate Cancel.
        actionsVariant="primary-buttons"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        {scriptId && (
          // Suspends with nothing in its place: what it is loading is already
          // drawn below, locked.
          <Suspense fallback={null}>
            <ScriptRecordLoader scriptId={scriptId} onResolved={setRecord} />
          </Suspense>
        )}

        {/* Locked fields are announced by nothing on their own — `disabled`
            reads as "unavailable", not "busy" — so the wait gets a line of its
            own. `sr-only` is out of flow, so it costs no layout.

            Mounted unconditionally, with only its TEXT switching: a live region
            that appears with its content already inside it is not reliably
            announced, and the emptied region is what retracts the message once
            the record lands. Gated on `loading` rather than `!isRecordReady`,
            which is also true for `missing` — that branch renders
            `NotFoundError` below, and announcing a load that never resolves
            next to it is the opposite of what the reader needs. */}
        <span role="status" className="sr-only">
          {record.status === 'loading' ? 'Loading script…' : ''}
        </span>

        {record.status === 'missing' ? (
          <NotFoundError message="Script not found" />
        ) : (
          <ScriptFields
            form={form}
            showErrors={showErrors}
            disabled={!isRecordReady}
            initialTags={record.status === 'ready' ? record.tags : NO_TAGS}
          />
        )}
      </PageLayout>

      <TestScriptModal
        isOpen={testPlatforms !== null}
        onClose={closeTestModal}
        onDeviceSelected={handleDeviceSelected}
        supportedPlatforms={testPlatforms ?? NO_PLATFORMS}
      />

      <ExecutionStartedModal
        isOpen={testDispatched}
        onClose={() => setTestDispatched(false)}
        scriptName={form.getValues('name') || 'Script'}
        onViewResults={handleViewLogs}
        viewLabel="View Logs"
        resultsLocation="activity logs section"
      />
    </>
  );
}

/**
 * Create + edit page for a script (v2, Relay).
 *
 * Keyed by id: the router reuses this route segment when only `?id=` changes, so
 * without the key a hop from script A to B would keep A's form state.
 */
export function EditScriptPage({ scriptId }: { scriptId: string | null }) {
  return <EditScriptForm key={scriptId ?? 'new'} scriptId={scriptId} />;
}
