/**
 * @generated SignedSource<<29778371ffaad6213e985ff41c253293>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type softwareLogStatusCell_execution$data = {
  readonly dispatchedAt: Instant;
  readonly status: ScriptExecutionStatus;
  readonly " $fragmentType": "softwareLogStatusCell_execution";
};
export type softwareLogStatusCell_execution$key = {
  readonly " $data"?: softwareLogStatusCell_execution$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogStatusCell_execution">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareLogStatusCell_execution",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "dispatchedAt",
      "storageKey": null
    }
  ],
  "type": "ScriptExecution",
  "abstractKey": null
};

(node as any).hash = "87465e3eeba2391052aa5d0cf7dd778d";

export default node;
