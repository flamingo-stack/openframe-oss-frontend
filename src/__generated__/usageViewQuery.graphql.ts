/**
 * @generated SignedSource<<3ea50c79979e460e381ec30266c43fb9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
export type SubscriptionProductStatus = "ACTIVE" | "EXPIRED" | "PENDING_ACTIVATION" | "%future added value";
import type { Long } from "../lib/graphql-scalars";
export type usageViewQuery$variables = Record<PropertyKey, never>;
export type usageViewQuery$data = {
  readonly subscription: {
    readonly id: string;
    readonly products: ReadonlyArray<{
      readonly name: OpenframeProduct;
      readonly packageOptions: ReadonlyArray<{
        readonly quantity: number | null | undefined;
        readonly status: SubscriptionProductStatus | null | undefined;
      }>;
      readonly payAsYouGoOption: {
        readonly id: string;
      } | null | undefined;
    }>;
    readonly usage: {
      readonly activeDevices: number;
      readonly aiTokensUsed: Long;
      readonly devicesUsed: number;
      readonly inactiveDevices: number;
    };
  } | null | undefined;
};
export type usageViewQuery = {
  response: usageViewQuery$data;
  variables: usageViewQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "quantity",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "SubscriptionOptionDetail",
  "kind": "LinkedField",
  "name": "payAsYouGoOption",
  "plural": false,
  "selections": [
    (v0/*: any*/)
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "SubscriptionUsage",
  "kind": "LinkedField",
  "name": "usage",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "devicesUsed",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "activeDevices",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inactiveDevices",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "aiTokensUsed",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "usageViewQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SubscriptionDetail",
        "kind": "LinkedField",
        "name": "subscription",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "SubscriptionProductDetail",
            "kind": "LinkedField",
            "name": "products",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "SubscriptionOptionDetail",
                "kind": "LinkedField",
                "name": "packageOptions",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              (v4/*: any*/)
            ],
            "storageKey": null
          },
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "usageViewQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SubscriptionDetail",
        "kind": "LinkedField",
        "name": "subscription",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "SubscriptionProductDetail",
            "kind": "LinkedField",
            "name": "products",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "SubscriptionOptionDetail",
                "kind": "LinkedField",
                "name": "packageOptions",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v0/*: any*/)
                ],
                "storageKey": null
              },
              (v4/*: any*/)
            ],
            "storageKey": null
          },
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a0ea4f9fdc6d29af8ef4558dbb8e82f8",
    "id": null,
    "metadata": {},
    "name": "usageViewQuery",
    "operationKind": "query",
    "text": "query usageViewQuery {\n  subscription {\n    id\n    products {\n      name\n      packageOptions {\n        quantity\n        status\n        id\n      }\n      payAsYouGoOption {\n        id\n      }\n    }\n    usage {\n      devicesUsed\n      activeDevices\n      inactiveDevices\n      aiTokensUsed\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "62000cdbc1fbad0c893e48b2b2d6288d";

export default node;
