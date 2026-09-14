import { graphql } from 'react-relay';

/**
 * The per-row field set both notification lists render — the header drawer
 * (unread only) and the full `/notifications` section.
 *
 * The two documents differ only in their arguments; the node selection is the
 * same, and it was written out twice before, which meant a new field had to be
 * added in both places or the drawer would silently render a row the section
 * could navigate from. Spreading one fragment makes that structural, and
 * `mapNotificationNode` reads a generated type instead of a hand-written mirror
 * of what the two documents happened to select.
 *
 * The notification's facts arrive as `type` + `attributes` — the spec-catalog
 * contract, a flat `string -> string` map. Entity ids live under fixed keys
 * regardless of the type, so a type this release has never heard of still
 * navigates and auto-reads. The typed `context` union the backend used to write
 * is deliberately NOT selected: it is retired, and a live push that omitted it
 * had to be written into the store as an explicit `null` link, which Relay
 * rejects — one failed updater then poisoned every later store commit until a
 * reload.
 *
 * `@inline` because the consumer is `mapNotificationNode`, a plain function
 * feeding the core lib's notification components — not a component of its own.
 */
export const notificationFieldsFragment = graphql`
  fragment notificationFields_notification on Notification @inline {
    id
    severity
    title
    description
    createdAt
    read
    category
    type
    attributes
  }
`;
