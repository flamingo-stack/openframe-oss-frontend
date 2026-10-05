/**
 * @generated SignedSource<<cf266cd8aae35dea61f674735d4ef3d1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type affectedSoftwareResolvedCell_software$data = {
  readonly resolvedInVersion: string | null | undefined;
  readonly " $fragmentType": "affectedSoftwareResolvedCell_software";
};
export type affectedSoftwareResolvedCell_software$key = {
  readonly " $data"?: affectedSoftwareResolvedCell_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"affectedSoftwareResolvedCell_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "affectedSoftwareResolvedCell_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "resolvedInVersion",
      "storageKey": null
    }
  ],
  "type": "AffectedSoftware",
  "abstractKey": null
};

(node as any).hash = "e8e2c787d12e9221967db6bb2fb84b3f";

export default node;
