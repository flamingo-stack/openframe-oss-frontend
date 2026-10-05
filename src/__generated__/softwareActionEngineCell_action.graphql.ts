/**
 * @generated SignedSource<<b8ce9d4ba2dc4a0dfcb0b6c87da45d21>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareActionEngineCell_action$data = {
  readonly engine: PackageManagerType;
  readonly " $fragmentType": "softwareActionEngineCell_action";
};
export type softwareActionEngineCell_action$key = {
  readonly " $data"?: softwareActionEngineCell_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionEngineCell_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareActionEngineCell_action",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "engine",
      "storageKey": null
    }
  ],
  "type": "SoftwareActionRun",
  "abstractKey": null
};

(node as any).hash = "a129c2d0aeb022c087b66250617beea9";

export default node;
