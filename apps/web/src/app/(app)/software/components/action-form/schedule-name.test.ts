import { describe, expect, it } from 'vitest';
import { ScheduleTimeReference } from '@/generated/schema-enums';
import { softwareScheduleName } from './schedule-name';

describe('softwareScheduleName', () => {
  const start = new Date(2026, 10, 18, 3, 0);

  it('names what runs and when, so a second run of the same program is a schedule of its own', () => {
    const first = softwareScheduleName(
      'Update',
      ['Adobe Acrobat DC (64-bit)'],
      new Date(2026, 10, 18, 1, 30),
      ScheduleTimeReference.SERVER,
    );
    const second = softwareScheduleName('Update', ['Adobe Acrobat DC (64-bit)'], start, ScheduleTimeReference.SERVER);
    expect(first).toBe('Update Adobe Acrobat DC (64-bit), 2026-11-18 01:30');
    expect(second).not.toBe(first);
  });

  it('tells the device-local clock from the server one at the same time', () => {
    expect(softwareScheduleName('Update', ['7zip.7zip', 'Git.Git'], start, ScheduleTimeReference.DEVICE_LOCAL)).toBe(
      'Update 7zip.7zip, Git.Git, 2026-11-18 03:00 (device local)',
    );
  });
});
