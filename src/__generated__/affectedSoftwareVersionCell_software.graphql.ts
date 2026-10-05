/**
 * @generated SignedSource<<cd75284ee912b53ec2bbb301eee868e7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type affectedSoftwareVersionCell_software$data = {
  readonly version: string | null | undefined;
  readonly " $fragmentType": "affectedSoftwareVersionCell_software";
};
export type affectedSoftwareVersionCell_software$key = {
  readonly " $data"?: affectedSoftwareVersionCell_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"affectedSoftwareVersionCell_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "affectedSoftwareVersionCell_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "version",
      "storageKey": null
    }
  ],
  "type": "AffectedSoftware",
  "abstractKey": null
};

(node as any).hash = "b9f2e9e52609008fa77061f3889275ee";

export default node;
