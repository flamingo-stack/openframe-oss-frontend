/**
 * @generated SignedSource<<57482aeaf261afaab02b758a3a523a05>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareActionStatus = "COMPLETED" | "FAILED" | "IN_PROGRESS" | "SCHEDULED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type softwareActionStatusCell_action$data = {
  readonly scheduledAt: Instant | null | undefined;
  readonly status: SoftwareActionStatus;
  readonly " $fragmentType": "softwareActionStatusCell_action";
};
export type softwareActionStatusCell_action$key = {
  readonly " $data"?: softwareActionStatusCell_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionStatusCell_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareActionStatusCell_action",
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
      "name": "scheduledAt",
      "storageKey": null
    }
  ],
  "type": "SoftwareActionRun",
  "abstractKey": null
};

(node as any).hash = "3bb47e945dcfe632478abc84d7ed4b89";

export default node;
