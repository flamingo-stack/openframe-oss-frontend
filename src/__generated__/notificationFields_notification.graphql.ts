/**
 * @generated SignedSource<<0f3147570164848e19d708922337bbbb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type NotificationCategory = "CUSTOMERS" | "DASHBOARD" | "DEVICES" | "GENERIC" | "INSIGHTS" | "LOGS" | "MINGO" | "MONITORING" | "SCRIPTS" | "SOFTWARE" | "TICKETS" | "%future added value";
export type NotificationReadStatus = "ARCHIVED" | "DELETED" | "READ" | "UNREAD" | "%future added value";
export type NotificationSeverity = "DANGER" | "INFO" | "SUCCESS" | "WARNING" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { JsonValue } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type notificationFields_notification$data = {
  readonly attributes: JsonValue | null | undefined;
  readonly category: NotificationCategory;
  readonly createdAt: Instant;
  readonly description: string | null | undefined;
  readonly id: string;
  readonly read: boolean;
  readonly severity: NotificationSeverity;
  readonly status: NotificationReadStatus;
  readonly title: string;
  readonly type: string | null | undefined;
  readonly " $fragmentType": "notificationFields_notification";
};
export type notificationFields_notification$key = {
  readonly " $data"?: notificationFields_notification$data;
  readonly " $fragmentSpreads": FragmentRefs<"notificationFields_notification">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "notificationFields_notification"
};

(node as any).hash = "77b59e0bc25ee41a686cd55e322639d6";

export default node;
