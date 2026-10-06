/**
 * @generated SignedSource<<c59cc1818502cd353cfcf39e9c52e7a9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareTable_software$data = ReadonlyArray<{
  readonly id: string;
  readonly " $fragmentSpreads": FragmentRefs<"softwareNameCell_software" | "softwareVersionCell_software" | "softwareVulnerabilitiesCell_software">;
  readonly " $fragmentType": "softwareTable_software";
}>;
export type softwareTable_software$key = ReadonlyArray<{
  readonly " $data"?: softwareTable_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareTable_software">;
}>;

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "softwareTable_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "softwareNameCell_software"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "softwareVersionCell_software"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "softwareVulnerabilitiesCell_software"
    }
  ],
  "type": "Software",
  "abstractKey": null
};

(node as any).hash = "5113e0333575112708bd450fc5dc2649";

export default node;
