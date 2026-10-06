/**
 * @generated SignedSource<<4c19f634e0201dc4b1424e16c9a3abc8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareNameCell_software$data = {
  readonly name: string;
  readonly publisher: string | null | undefined;
  readonly " $fragmentType": "softwareNameCell_software";
};
export type softwareNameCell_software$key = {
  readonly " $data"?: softwareNameCell_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareNameCell_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareNameCell_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "publisher",
      "storageKey": null
    }
  ],
  "type": "Software",
  "abstractKey": null
};

(node as any).hash = "b6e0b37dbdbd6c7c0a48f375f5c3477b";

export default node;
