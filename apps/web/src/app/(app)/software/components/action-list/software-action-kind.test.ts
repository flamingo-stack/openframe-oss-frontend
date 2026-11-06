import { describe, expect, it } from 'vitest';
import { SoftwareActionKind } from '@/generated/schema-enums';
import { softwareActionKindLabel } from './software-action-kind';

describe('softwareActionKindLabel', () => {
  it('words each kind the way the Action column and its funnel show it', () => {
    expect(softwareActionKindLabel(SoftwareActionKind.INSTALL)).toBe('Install');
    expect(softwareActionKindLabel(SoftwareActionKind.UPDATE)).toBe('Update');
    expect(softwareActionKindLabel(SoftwareActionKind.AUTO_UPDATE)).toBe('Auto-update');
    expect(softwareActionKindLabel(SoftwareActionKind.ADOPT)).toBe('Adopt');
  });

  it('a kind this build does not know has no word, so the row shows it as it came', () => {
    expect(softwareActionKindLabel('UNINSTALL')).toBeUndefined();
  });
});
