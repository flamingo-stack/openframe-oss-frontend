/**
 * @generated SignedSource<<117925ec2acfd608fc3d33e410d433bf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type RemoteAccessDecisionSource = "FALLBACK" | "POLICY" | "TECHNICIAN" | "TIMEOUT" | "USER" | "%future added value";
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
export type RemoteAccessRequestStatus = "APPROVED" | "CANCELLED" | "DELIVERED" | "DENIED" | "EXPIRED" | "PENDING" | "REVOKED" | "TIMED_OUT" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessApprovalApiService_request$data = {
  readonly createdAt: Instant;
  readonly decisionSource: RemoteAccessDecisionSource | null | undefined;
  readonly deliveredAt: Instant | null | undefined;
  readonly deviceId: string;
  readonly expiresAt: Instant;
  readonly mode: RemoteAccessMode;
  readonly reason: string | null | undefined;
  readonly recordingEnabled: boolean;
  readonly requestId: string;
  readonly resolvedAt: Instant | null | undefined;
  readonly status: RemoteAccessRequestStatus;
  readonly technicianId: string;
  readonly ticketId: string | null | undefined;
  readonly ticketNumber: string | null | undefined;
  readonly " $fragmentType": "remoteAccessApprovalApiService_request";
};
export type remoteAccessApprovalApiService_request$key = {
  readonly " $data"?: remoteAccessApprovalApiService_request$data;
  readonly " $fragmentSpreads": FragmentRefs<"remoteAccessApprovalApiService_request">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "remoteAccessApprovalApiService_request"
};

(node as any).hash = "0745445e817db0928be5ecacdb20f9e8";

export default node;
