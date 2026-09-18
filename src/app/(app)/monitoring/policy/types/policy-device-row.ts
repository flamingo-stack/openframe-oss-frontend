export type ComplianceStatus = 'non-compliant' | 'passing' | 'pending';

export interface PolicyDeviceRow {
  id: string;
  hostname: string;
  /** The device name as every other screen renders it (`getDeviceName`), or the Fleet host name for a host with no device record. */
  name: string;
  deviceType: string | undefined;
  organization: string | undefined;
  organizationImageUrl: string | null | undefined;
  organizationImageHash: string | null | undefined;
  osType: string | undefined;
  complianceStatus: ComplianceStatus;
  machineId: string | undefined;
  fleetHostId: number;
}
