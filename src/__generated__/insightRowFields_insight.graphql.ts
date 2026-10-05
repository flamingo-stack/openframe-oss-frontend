/**
 * @generated SignedSource<<ca4109fc66874800559f3c2ebfa233d2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type InsightSeverity = "CRITICAL" | "HIGH" | "INFO" | "LOW" | "MEDIUM" | "%future added value";
export type InsightStatus = "ACKNOWLEDGED" | "ARCHIVED" | "NEW" | "RESOLVED" | "SNOOZED" | "%future added value";
export type InsightType = "IT" | "SECURITY" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type insightRowFields_insight$data = {
  readonly assignee: {
    readonly " $fragmentSpreads": FragmentRefs<"insightUserFields_user">;
  } | null | undefined;
  readonly assigneeId: string | null | undefined;
  readonly detectedAt: Instant;
  readonly id: string;
  readonly machine: {
    readonly displayName: string | null | undefined;
    readonly hostname: string | null | undefined;
    readonly nickname: string | null | undefined;
    readonly type: DeviceType | null | undefined;
  } | null | undefined;
  readonly machineId: string;
  readonly organization: {
    readonly id: string;
    readonly name: string;
  } | null | undefined;
  readonly organizationId: string;
  readonly severity: InsightSeverity;
  readonly snoozedUntil: Instant | null | undefined;
  readonly status: InsightStatus;
  readonly title: string;
  readonly type: InsightType;
  readonly " $fragmentType": "insightRowFields_insight";
};
export type insightRowFields_insight$key = {
  readonly " $data"?: insightRowFields_insight$data;
  readonly " $fragmentSpreads": FragmentRefs<"insightRowFields_insight">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "insightRowFields_insight"
};

(node as any).hash = "7549f500973ffe63e784b9633c08fd62";

export default node;
