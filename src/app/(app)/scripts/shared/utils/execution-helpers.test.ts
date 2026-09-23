import { describe, expect, it } from 'vitest';
import { executionOutput, executionResultText, machineLabel, organizationLabel } from './execution-helpers';

describe('script execution presentation', () => {
  it('preserves every output channel for both execution views', () => {
    const result = { stdout: 'progress', stderr: 'warning', error: 'failed' };

    expect(executionOutput(result)).toBe('progress\n\nwarning\n\nfailed');
    expect(executionResultText(result)).toBe('progress\n\nwarning\n\nfailed');
  });

  it('retains machine and organization labels used by Guide mode', () => {
    const machine = { machineId: 'machine-1', displayName: 'Office PC', organization: { name: 'Acme' } };

    expect(machineLabel(machine)).toBe('Office PC');
    expect(organizationLabel(machine)).toBe('Acme');
  });
});
