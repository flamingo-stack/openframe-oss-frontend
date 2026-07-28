import { graphql } from 'react-relay';

/**
 * Script autocomplete for the schedule create/edit form. Lists ACTIVE scripts
 * with server-side name search, narrowed to the schedule's supported platforms.
 * Fetched imperatively (`fetchQuery`) by `use-schedule-scripts-autocomplete` —
 * a dropdown refreshes per keystroke, so imperative fetch beats a suspending
 * hook here; results still land in the Relay store.
 *
 * `defaultTimeoutSeconds` / `defaultArgs` / `envVars` seed the picked script's
 * run-parameter fields in the schedule card, so the card shows what the script
 * will actually run with instead of blank inputs.
 */
export const scheduleScriptsPickerRelayQuery = graphql`
  query scheduleScriptsPickerRelayQuery($search: String, $platforms: [ScriptPlatform!], $first: Int!) {
    scripts(filter: { statuses: [ACTIVE], supportedPlatforms: $platforms }, search: $search, first: $first) {
      edges {
        node {
          id
          name
          supportedPlatforms
          defaultTimeoutSeconds
          defaultArgs
          envVars {
            name
            value
          }
        }
      }
    }
  }
`;
