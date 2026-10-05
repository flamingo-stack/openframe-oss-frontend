/**
 * @generated SignedSource<<52a9b45b68474e7358d7025b4baa786e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareSource = "BREW" | "CHOCOLATEY" | "UNMANAGED" | "WINGET" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type affectedSoftwareNameCell_software$data = {
  readonly name: string;
  readonly source: SoftwareSource | null | undefined;
  readonly " $fragmentType": "affectedSoftwareNameCell_software";
};
export type affectedSoftwareNameCell_software$key = {
  readonly " $data"?: affectedSoftwareNameCell_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"affectedSoftwareNameCell_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "affectedSoftwareNameCell_software",
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
      "name": "source",
      "storageKey": null
    }
  ],
  "type": "AffectedSoftware",
  "abstractKey": null
};

(node as any).hash = "ca4ded2d63dbf9f145a5d3737c519277";

export default node;
