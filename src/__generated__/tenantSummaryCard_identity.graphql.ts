/**
 * @generated SignedSource<<b64cace7b0f00936017f83eef2bd835d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type tenantSummaryCard_identity$data = {
  readonly domain: string | null | undefined;
  readonly provider: DirectoryProvider;
  readonly " $fragmentType": "tenantSummaryCard_identity";
};
export type tenantSummaryCard_identity$key = {
  readonly " $data"?: tenantSummaryCard_identity$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantSummaryCard_identity">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantSummaryCard_identity",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "provider",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "domain",
      "storageKey": null
    }
  ],
  "type": "DirectoryConnection",
  "abstractKey": null
};

(node as any).hash = "003d7c704b73b17b509392ccffeabcfd";

export default node;
