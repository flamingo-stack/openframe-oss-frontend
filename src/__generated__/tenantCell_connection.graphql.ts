/**
 * @generated SignedSource<<8a309c683361372f0d3c6eaf0a853779>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type tenantCell_connection$data = {
  readonly domain: string | null | undefined;
  readonly name: string;
  readonly provider: DirectoryProvider;
  readonly " $fragmentType": "tenantCell_connection";
};
export type tenantCell_connection$key = {
  readonly " $data"?: tenantCell_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantCell_connection">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantCell_connection",
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
      "name": "name",
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

(node as any).hash = "58b8a3b1df4e00e2d4c23f8dcef7ce3f";

export default node;
