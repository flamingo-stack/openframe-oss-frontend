/**
 * @generated SignedSource<<a657aa4fc455ae8da5b006166b3e93c8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
export type RemoteSessionEndReason = "ADMIN" | "CLIENT" | "CONNECTION_LOST" | "POLICY" | "TIMEOUT" | "%future added value";
export type RemoteSessionStatus = "ACTIVE" | "ENDED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type remoteSessionApiService_session$data = {
  readonly deviceId: string;
  readonly dialogId: string | null | undefined;
  readonly endReason: RemoteSessionEndReason | null | undefined;
  readonly endedAt: Instant | null | undefined;
  readonly mode: RemoteAccessMode;
  readonly reason: string | null | undefined;
  readonly recordingEnabled: boolean;
  readonly requestId: string;
  readonly sessionId: string;
  readonly startedAt: Instant;
  readonly status: RemoteSessionStatus;
  readonly technicianId: string;
  readonly ticketId: string | null | undefined;
  readonly ticketNumber: string | null | undefined;
  readonly " $fragmentType": "remoteSessionApiService_session";
};
export type remoteSessionApiService_session$key = {
  readonly " $data"?: remoteSessionApiService_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"remoteSessionApiService_session">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "remoteSessionApiService_session"
};

(node as any).hash = "c8ae216e8d3de44089eee3570a416d12";

export default node;
