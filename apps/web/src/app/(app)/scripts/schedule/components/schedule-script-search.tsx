'use client';

import {
  type ScheduleFormScriptRow,
  ScheduleScriptSearchField,
  type ScheduleScriptSearchSlotProps,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useMemo } from 'react';
import { parseKeyValues } from '../../shared/utils/script-key-values';
import { envVarsToPairs, platformsToIds } from '../../shared/utils/script-mappers';
import { type PickerScript, useScheduleScriptsAutocomplete } from '../hooks/use-schedule-scripts-autocomplete';
import { toEnvVarInputs } from '../utils/schedule-script-params';

/** Fallback when the picked script carries no timeout of its own (design default). */
const DEFAULT_TIMEOUT_SECONDS = 90;

/**
 * A picked script as the card's form row.
 *
 * Seeds the run parameters from the script itself — that IS what the schedule
 * will run with, so the card never shows blanks for a real script. A freshly
 * picked script therefore starts UNCUSTOMISED: the defaults ride along beside
 * the editable copy, and submit writes an override only for a half the user
 * actually moved off them.
 */
function scriptToFormRow(script: PickerScript): ScheduleFormScriptRow {
  return {
    scriptId: script.id,
    name: script.name,
    // Carried into the form so the schedule-vs-script platform check can run
    // on submit without re-reading the (search-scoped, paged) picker list.
    supportedPlatforms: platformsToIds(script.supportedPlatforms),
    timeoutSeconds: script.defaultTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
    args: parseKeyValues(script.defaultArgs, ' '),
    envVars: envVarsToPairs(script.envVars),
    defaultArgs: script.defaultArgs ? [...script.defaultArgs] : [],
    defaultEnvVars: toEnvVarInputs(script.envVars),
  };
}

/**
 * The schedule form's "Select Script" slot: the core library's field over this
 * app's Relay-backed script search, narrowed server-side to the platforms the
 * schedule targets.
 */
export function ScheduleScriptSearch({
  scriptId,
  name,
  supportedPlatforms,
  onPick,
  disabled,
  error,
  invalid,
}: ScheduleScriptSearchSlotProps) {
  const { scripts, isLoading, inputValue, onInputChange, onOpen, onClose } =
    useScheduleScriptsAutocomplete(supportedPlatforms);

  const results = useMemo(
    () => scripts.map(s => ({ id: s.id, name: s.name, supportedPlatforms: platformsToIds(s.supportedPlatforms) })),
    [scripts],
  );

  const handleChange = (pickedId: string | null) => {
    if (!pickedId) {
      onPick(null);
      return;
    }
    const script = scripts.find(s => s.id === pickedId);
    if (script) onPick(scriptToFormRow(script));
  };

  return (
    <ScheduleScriptSearchField
      scriptId={scriptId}
      name={name}
      scripts={results}
      isLoading={isLoading}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onOpen={onOpen}
      onClose={onClose}
      onChange={handleChange}
      disabled={disabled}
      error={error}
      invalid={invalid}
    />
  );
}
