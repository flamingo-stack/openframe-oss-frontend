import { describe, expect, it } from 'vitest';
import { DirectoryMatchKey, DirectoryProvider } from '@/generated/schema-enums';
import { deviceOrigin, machineLinkFacts, machineSummary, matchedKeysLabel, recordDetail } from './device-presentation';

describe('deviceOrigin', () => {
  it('tells a record apart by its source and sourceId prefix', () => {
    expect(deviceOrigin(DirectoryProvider.MICROSOFT_365, 'abc').member).toBe('Entra device');
    expect(deviceOrigin(DirectoryProvider.MICROSOFT_365, 'intune:abc').member).toBe('Intune device');
    expect(deviceOrigin(DirectoryProvider.GOOGLE_WORKSPACE, 'chromeos:abc').member).toBe('ChromeOS device');
    expect(deviceOrigin(DirectoryProvider.GOOGLE_WORKSPACE, 'mobile:abc').member).toBe('Mobile device');
    expect(deviceOrigin(DirectoryProvider.GOOGLE_WORKSPACE, 'abc').member).toBe('Google device');
  });
});

describe('recordDetail', () => {
  const origin = deviceOrigin(DirectoryProvider.MICROSOFT_365, 'abc');

  it('says where the record comes from and when it was last seen', () => {
    const at = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(recordDetail(origin, at)).toBe('Entra ID, last seen 20 minutes ago');
  });

  it('says only where it comes from when the provider gives no date', () => {
    expect(recordDetail(origin, null)).toBe('Entra ID');
    expect(recordDetail(origin, 'not a date')).toBe('Entra ID');
  });
});

describe('matchedKeysLabel', () => {
  it('names the keys that agree, keeping one this build does not know', () => {
    expect(matchedKeysLabel([DirectoryMatchKey.HOSTNAME, DirectoryMatchKey.OS])).toBe('Hostname, OS');
    expect(matchedKeysLabel(Object.values(DirectoryMatchKey))).toBe('Hostname, OS, Serial Number');
    expect(matchedKeysLabel(['NEW_KEY'])).toBe('NEW_KEY');
  });
});

describe('machineSummary', () => {
  it('reads the type and the OS version, leaving out what is missing', () => {
    expect(machineSummary('LAPTOP', 'Windows 11 23H2')).toBe('Laptop, Windows 11 23H2');
    expect(machineSummary(null, 'Windows 11 23H2')).toBe('Windows 11 23H2');
    expect(machineSummary('DESKTOP', null)).toBe('Desktop');
  });
});

describe('machineLinkFacts', () => {
  it('says whether the machine already has a directory record', () => {
    expect(machineLinkFacts('CND9921', [])).toBe('Serial number CND9921, no directory record');
    expect(machineLinkFacts(null, ['MICROSOFT_365'])).toBe('already has a directory record');
  });
});
