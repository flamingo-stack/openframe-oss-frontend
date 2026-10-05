/**
 * @generated SignedSource<<3b490a07a25a966d7434d5badebbcfad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiService_organization$data = {
  readonly effectiveMode: RemoteAccessMode;
  readonly mode: RemoteAccessMode | null | undefined;
  readonly " $fragmentType": "remoteAccessPolicyApiService_organization";
};
export type remoteAccessPolicyApiService_organization$key = {
  readonly " $data"?: remoteAccessPolicyApiService_organization$data;
  readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_organization">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "remoteAccessPolicyApiService_organization"
};

(node as any).hash = "82fcf632824573a21e149138abc6f7e2";

export default node;
