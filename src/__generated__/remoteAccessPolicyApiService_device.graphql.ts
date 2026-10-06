/**
 * @generated SignedSource<<57100222298bf76ed9386755375e8c48>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
export type RemoteAccessPolicyScope = "DEFAULTS" | "DEVICE" | "ORGANIZATION" | "TENANT" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiService_device$data = {
  readonly effectiveMode: RemoteAccessMode;
  readonly effectiveScope: RemoteAccessPolicyScope;
  readonly mode: RemoteAccessMode | null | undefined;
  readonly " $fragmentType": "remoteAccessPolicyApiService_device";
};
export type remoteAccessPolicyApiService_device$key = {
  readonly " $data"?: remoteAccessPolicyApiService_device$data;
  readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_device">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "remoteAccessPolicyApiService_device"
};

(node as any).hash = "d4fbe5cfc0e95d8ebdd055ccce6896d8";

export default node;
