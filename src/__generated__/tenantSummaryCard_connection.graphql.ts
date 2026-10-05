/**
 * @generated SignedSource<<de30bffc8575470f4d36c81b16a6231e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DirectoryAccessState = "CONSENT_REVOKED" | "DISCONNECTED" | "NOT_AUTHORISED" | "READ_ONLY" | "WRITE_AVAILABLE" | "WRITE_ENABLED" | "%future added value";
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type tenantSummaryCard_connection$data = {
  readonly access: {
    readonly state: DirectoryAccessState;
  };
  readonly connectedAt: Instant | null | undefined;
  readonly domain: string | null | undefined;
  readonly lastSyncAt: Instant | null | undefined;
  readonly organization: {
    readonly image: {
      readonly hash: string | null | undefined;
      readonly imageUrl: string;
    } | null | undefined;
    readonly name: string;
  };
  readonly provider: DirectoryProvider;
  readonly userCount: number | null | undefined;
  readonly " $fragmentType": "tenantSummaryCard_connection";
};
export type tenantSummaryCard_connection$key = {
  readonly " $data"?: tenantSummaryCard_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantSummaryCard_connection">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantSummaryCard_connection",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "userCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "connectedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastSyncAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DirectoryConnectionAccess",
      "kind": "LinkedField",
      "name": "access",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "state",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Organization",
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
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
          "concreteType": "OrganizationImage",
          "kind": "LinkedField",
          "name": "image",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "imageUrl",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hash",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DirectoryConnection",
  "abstractKey": null
};

(node as any).hash = "4b31d28a743dd40b254dc6d1154217a2";

export default node;
