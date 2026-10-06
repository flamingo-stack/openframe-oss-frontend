/**
 * @generated SignedSource<<65b0080ba1b7eb0fbcdc576292e419bf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareDetailHeader_software$data = {
  readonly name: string;
  readonly " $fragmentType": "softwareDetailHeader_software";
};
export type softwareDetailHeader_software$key = {
  readonly " $data"?: softwareDetailHeader_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareDetailHeader_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareDetailHeader_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Software",
  "abstractKey": null
};

(node as any).hash = "d17f086aca4870d9ca79c0afeb5f10e8";

export default node;
