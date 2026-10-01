import { describe, expect, it } from 'vitest';
import { asInstant } from '@/lib/graphql-scalars';
import type { LogEntry } from '../../logs-page/types/log.types';
import { splitLogDetails } from './split-log-details';

const base: LogEntry = {
  toolEventId: 'evt-1',
  eventType: 'SCRIPT_EXECUTED',
  ingestDay: '2026-10-01',
  toolType: 'RMM',
  severity: 'INFO',
  summary: 'Script executed',
  message: 'Script hello executed.',
  timestamp: asInstant('2026-10-01T10:46:31.534Z'),
  details: null,
};

const scriptRun = {
  result: {
    output: 'hello from mingo\n',
    exit_code: 0,
    execution_time_ms: 28,
    input: { name: 'Mingo origin test', shell: 'BASH', defaultArgs: [] },
  },
  additional_info: { exit_code: 0, execution_time_ms: 28, timed_out: false },
};

describe('splitLogDetails', () => {
  it('lifts result.input out and leaves the rest of the result in place', () => {
    const sections = splitLogDetails({ ...base, details: JSON.stringify(scriptRun) });

    expect(sections.outputTitle).toBe('Output');
    expect(sections.input).toEqual(scriptRun.result.input);
    expect(sections.output).toEqual({
      result: { output: 'hello from mingo\n', exit_code: 0, execution_time_ms: 28 },
      additional_info: scriptRun.additional_info,
    });
  });

  it('drops an emptied result block rather than leaving `result: {}` behind', () => {
    const details = JSON.stringify({ result: { input: { shell: 'BASH' } }, error: { exit_code: 1 } });

    expect(splitLogDetails({ ...base, details }).output).toEqual({ error: { exit_code: 1 } });
  });

  it('keeps a log without result.input as a single Details block', () => {
    const details = JSON.stringify({ result: { output: 'ok', exit_code: 0 } });

    expect(splitLogDetails({ ...base, details })).toEqual({
      output: { result: { output: 'ok', exit_code: 0 } },
      outputTitle: 'Details',
    });
  });

  it('shows a non-object details document as it is', () => {
    expect(splitLogDetails({ ...base, details: '[1, 2]' })).toEqual({ output: [1, 2], outputTitle: 'Details' });
  });

  it('falls back to the identifying fields when details are absent', () => {
    const { output, outputTitle, input } = splitLogDetails(base);

    expect(outputTitle).toBe('Details');
    expect(input).toBeUndefined();
    expect(output).toMatchObject({ toolEventId: 'evt-1', eventType: 'SCRIPT_EXECUTED', message: base.message });
    expect(output).not.toHaveProperty('rawDetails');
  });

  it('keeps unparseable details as rawDetails beside the identifying fields', () => {
    const { output } = splitLogDetails({ ...base, details: 'not json' });

    expect(output).toMatchObject({ toolEventId: 'evt-1', rawDetails: 'not json' });
  });
});
