/**
 * @generated SignedSource<<3a13481d964519d9438cf553f6499c2d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiService_tenant$data = {
  readonly mode: RemoteAccessMode;
  readonly " $fragmentType": "remoteAccessPolicyApiService_tenant";
};
export type remoteAccessPolicyApiService_tenant$key = {
  readonly " $data"?: remoteAccessPolicyApiService_tenant$data;
  readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_tenant">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "remoteAccessPolicyApiService_tenant"
};

(node as any).hash = "6cfd2583ac20ab78f9c92db8eb842e4d";

export default node;
