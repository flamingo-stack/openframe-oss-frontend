/**
 * @generated SignedSource<<9ad003290c2ae64566f0274d23b66686>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareActionTypeCell_action$data = {
  readonly action: SoftwareAction;
  readonly " $fragmentType": "softwareActionTypeCell_action";
};
export type softwareActionTypeCell_action$key = {
  readonly " $data"?: softwareActionTypeCell_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionTypeCell_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareActionTypeCell_action",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "action",
      "storageKey": null
    }
  ],
  "type": "SoftwareActionRun",
  "abstractKey": null
};

(node as any).hash = "7e60f9ffb1ec187c25aaf364ba700cca";

export default node;
