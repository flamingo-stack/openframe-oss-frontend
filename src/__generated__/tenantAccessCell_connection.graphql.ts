/**
 * @generated SignedSource<<f969b34250253e8395f2b8db3dc287c6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DirectoryAccessState = "CONSENT_REVOKED" | "DISCONNECTED" | "NOT_AUTHORISED" | "READ_ONLY" | "WRITE_AVAILABLE" | "WRITE_ENABLED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type tenantAccessCell_connection$data = {
  readonly access: {
    readonly state: DirectoryAccessState;
  };
  readonly lastSyncAt: Instant | null | undefined;
  readonly " $fragmentType": "tenantAccessCell_connection";
};
export type tenantAccessCell_connection$key = {
  readonly " $data"?: tenantAccessCell_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantAccessCell_connection">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantAccessCell_connection",
  "selections": [
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
    }
  ],
  "type": "DirectoryConnection",
  "abstractKey": null
};

(node as any).hash = "7f6072cf75a1e2f8252b2c4871c01336";

export default node;
