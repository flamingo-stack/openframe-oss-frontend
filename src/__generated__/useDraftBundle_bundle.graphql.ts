/**
 * @generated SignedSource<<59ca941aff5467aa04427dac46e3543d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type useDraftBundle_bundle$data = {
  readonly deviceCount: number;
  readonly id: string;
  readonly " $fragmentType": "useDraftBundle_bundle";
};
export type useDraftBundle_bundle$key = {
  readonly " $data"?: useDraftBundle_bundle$data;
  readonly " $fragmentSpreads": FragmentRefs<"useDraftBundle_bundle">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useDraftBundle_bundle",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "deviceCount",
      "storageKey": null
    }
  ],
  "type": "SoftwareBundle",
  "abstractKey": null
};

(node as any).hash = "49e6d94ca3b941d5ecdba7dc8e6b6837";

export default node;
