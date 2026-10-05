/**
 * @generated SignedSource<<1cbb11b845679a53d8a7aa3739f55360>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareActionProcessedCell_action$data = {
  readonly respondedMachineCount: number;
  readonly totalMachineCount: number;
  readonly " $fragmentType": "softwareActionProcessedCell_action";
};
export type softwareActionProcessedCell_action$key = {
  readonly " $data"?: softwareActionProcessedCell_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionProcessedCell_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareActionProcessedCell_action",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "respondedMachineCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalMachineCount",
      "storageKey": null
    }
  ],
  "type": "SoftwareActionRun",
  "abstractKey": null
};

(node as any).hash = "be41156926c8bec2216c60c7ccb906a6";

export default node;
