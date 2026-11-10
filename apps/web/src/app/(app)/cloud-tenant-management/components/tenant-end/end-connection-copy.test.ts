import { describe, expect, it } from 'vitest';
import { DirectoryProvider } from '@/generated/schema-enums';
import { customerTenantStepsText, deleteSections, disconnectSections, endConnectionIntro } from './end-connection-copy';

const IMPACT = { users: 412, groups: 31, licenseAssignments: 396, cloudOnlyDevices: 2, agentDeviceLinks: 5 };

const value = (sections: ReturnType<typeof disconnectSections>, id: string) =>
  sections.flatMap(section => section.rows).find(row => row.id === id)?.value;

describe('disconnectSections', () => {
  it('counts what stays (Figma 3287-23208)', () => {
    const sections = disconnectSections(IMPACT);
    expect(sections.map(section => section.title)).toEqual(['Stops', 'Stays, read-only']);
    expect(value(sections, 'users')).toBe('412 users, 31 groups');
    expect(value(sections, 'licences')).toBe('396 assignments');
  });

  it('says the licences have not been read rather than zero, and draws bars with no counts yet', () => {
    expect(value(disconnectSections({ ...IMPACT, licenseAssignments: null }), 'licences')).toBe('Not read yet');
    expect(value(disconnectSections(null), 'users')).toBe('');
  });
});

describe('deleteSections', () => {
  it('counts what goes (Figma 3287-22492)', () => {
    const sections = deleteSections(
      { users: 184, groups: 12, licenseAssignments: 184, cloudOnlyDevices: 2, agentDeviceLinks: 5 },
      DirectoryProvider.MICROSOFT_365,
    );
    expect(value(sections, 'users')).toBe('184 records, with where each value came from');
    expect(value(sections, 'groups')).toBe('12 groups and their members');
    expect(value(sections, 'devices')).toBe('2 cloud-only records and 5 links to agent devices');
  });

  it('names what each provider holds', () => {
    expect(value(deleteSections(IMPACT, DirectoryProvider.MICROSOFT_365), 'connection')).toContain('the client secret');
    expect(value(deleteSections(IMPACT, DirectoryProvider.GOOGLE_WORKSPACE), 'connection')).toContain('the credential');
  });

  it('counts one of a thing as one', () => {
    const sections = deleteSections(
      { users: 1, groups: 1, licenseAssignments: 1, cloudOnlyDevices: 1, agentDeviceLinks: 1 },
      DirectoryProvider.MICROSOFT_365,
    );
    expect(value(sections, 'users')).toBe('1 record, with where each value came from');
    expect(value(sections, 'devices')).toBe('1 cloud-only record and 1 link to agent devices');
  });
});

describe('the customer tenant steps', () => {
  it('copies as one text, per provider', () => {
    expect(customerTenantStepsText(DirectoryProvider.MICROSOFT_365)).toMatch(/^Do one of these in Microsoft Entra/);
    const google = customerTenantStepsText(DirectoryProvider.GOOGLE_WORKSPACE);
    expect(google).toMatch(/^Do one of these in Google:\n- Admin console/);
    expect(google).toMatch(/Manage Third-Party App Access › OpenFrame › Blocked\.$/);
  });

  it('keeps Microsoft-only wording out of the Google intro', () => {
    expect(endConnectionIntro('disconnect', DirectoryProvider.GOOGLE_WORKSPACE)).not.toContain('client secret');
    expect(endConnectionIntro('disconnect', DirectoryProvider.MICROSOFT_365)).toContain('client secret');
  });
});
