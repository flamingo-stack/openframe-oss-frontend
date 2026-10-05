/**
 * @generated SignedSource<<1c1554e083afcde67c884b834337d02f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareDetailSummary_software$data = {
  readonly latestVersion: string | null | undefined;
  readonly publisher: string | null | undefined;
  readonly " $fragmentType": "softwareDetailSummary_software";
};
export type softwareDetailSummary_software$key = {
  readonly " $data"?: softwareDetailSummary_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareDetailSummary_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareDetailSummary_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "publisher",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "latestVersion",
      "storageKey": null
    }
  ],
  "type": "Software",
  "abstractKey": null
};

(node as any).hash = "a83bb58fb80dd9b19bb4d03475d3f91c";

export default node;
