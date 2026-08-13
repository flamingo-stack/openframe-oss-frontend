import { graphql } from 'react-relay';

/**
 * Per-user master switch. `typeSettings` is intentionally omitted — the mutation keeps the
 * stored group overrides when it is absent; the per-group checkboxes UI is a separate task.
 */
export const updateNotificationSettingsMutation = graphql`
  mutation updateNotificationSettingsMutation($enabled: Boolean!) {
    updateNotificationSettings(enabled: $enabled) {
      enabled
      contentSuppressed
    }
  }
`;
