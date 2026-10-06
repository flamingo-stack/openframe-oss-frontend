/**
 * @generated SignedSource<<2153d572e5c03b4d0385c14f350b98bb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareVersionStatus = "OUTDATED" | "UNKNOWN" | "UP_TO_DATE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareVersionCell_software$data = {
  readonly currentVersion: string | null | undefined;
  readonly olderVersionsCount: number | null | undefined;
  readonly versionStatus: SoftwareVersionStatus | null | undefined;
  readonly " $fragmentType": "softwareVersionCell_software";
};
export type softwareVersionCell_software$key = {
  readonly " $data"?: softwareVersionCell_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareVersionCell_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareVersionCell_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "currentVersion",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "versionStatus",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "olderVersionsCount",
      "storageKey": null
    }
  ],
  "type": "Software",
  "abstractKey": null
};

(node as any).hash = "48ed8f047b63c3555340867c7bf66c67";

export default node;
