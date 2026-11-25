import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { AttentionAlert } from '@/app/components/shared/attention-alert';

/**
 * The install steps' macOS note: Fleet (and the inventory, software, vulnerabilities and policies it feeds) needs
 * macOS 13 or later, while the OpenFrame agent itself installs on older Macs too. Nothing for other platforms.
 *
 * The version is written out here: no device exists yet to read `Machine.unsupportedTools` from, and the tool
 * catalogue that holds the minimum is not on GraphQL. Keep it equal to the `fleetmdm-agent` macOS minimum.
 */
export function MacosFleetRequirementAlert({ platform }: { platform: OSPlatformId }) {
  if (platform !== 'darwin') return null;
  return (
    <AttentionAlert
      variant="warning"
      title="Fleet features need macOS 13 or later"
      description="On older macOS versions, the agent installs, but inventory, software, vulnerabilities and policies stay unavailable."
    />
  );
}
