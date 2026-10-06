/**
 * @generated SignedSource<<67239d0ef74490c0a972ae41097457e6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type BillingPeriod = "MONTHLY" | "YEARLY" | "%future added value";
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
import type { Long } from "../lib/graphql-scalars";
export type subscriptionSettingsViewQuery$variables = Record<PropertyKey, never>;
export type subscriptionSettingsViewQuery$data = {
  readonly billingPlan: {
    readonly id: string;
    readonly products: ReadonlyArray<{
      readonly id: string;
      readonly name: OpenframeProduct;
      readonly packageOptions: ReadonlyArray<{
        readonly billingPeriod: BillingPeriod | null | undefined;
      }>;
      readonly payAsYouGoOption: {
        readonly id: string;
        readonly price: number | null | undefined;
      } | null | undefined;
      readonly unitSize: Long | null | undefined;
      readonly " $fragmentSpreads": FragmentRefs<"devicePlanPickerProductFragment">;
    }>;
  } | null | undefined;
  readonly subscription: {
    readonly aiSpendCapUsd: number | null | undefined;
    readonly id: string;
    readonly products: ReadonlyArray<{
      readonly name: OpenframeProduct;
      readonly " $fragmentSpreads": FragmentRefs<"devicePlanPickerSubscriptionFragment">;
    }>;
    readonly usage: {
      readonly activeDevices: number;
    };
  } | null | undefined;
};
export type subscriptionSettingsViewQuery = {
  response: subscriptionSettingsViewQuery$data;
  variables: subscriptionSettingsViewQuery$variables;
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
  "name": "billingPeriod",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "unitSize",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "price",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "aiSpendCapUsd",
  "storageKey": null
},
v6 = {
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
      "name": "activeDevices",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "PriceTier",
  "kind": "LinkedField",
  "name": "priceTiers",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "from",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "upTo",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "unitPrice",
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
    "name": "subscriptionSettingsViewQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "BillingPlanDetails",
        "kind": "LinkedField",
        "name": "billingPlan",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Product",
            "kind": "LinkedField",
            "name": "products",
            "plural": true,
            "selections": [
              (v0/*: any*/),
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProductOption",
                "kind": "LinkedField",
                "name": "packageOptions",
                "plural": true,
                "selections": [
                  (v2/*: any*/)
                ],
                "storageKey": null
              },
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProductOption",
                "kind": "LinkedField",
                "name": "payAsYouGoOption",
                "plural": false,
                "selections": [
                  (v0/*: any*/),
                  (v4/*: any*/)
                ],
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "devicePlanPickerProductFragment"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SubscriptionDetail",
        "kind": "LinkedField",
        "name": "subscription",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
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
                "args": null,
                "kind": "FragmentSpread",
                "name": "devicePlanPickerSubscriptionFragment"
              }
            ],
            "storageKey": null
          }
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
    "name": "subscriptionSettingsViewQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "BillingPlanDetails",
        "kind": "LinkedField",
        "name": "billingPlan",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Product",
            "kind": "LinkedField",
            "name": "products",
            "plural": true,
            "selections": [
              (v0/*: any*/),
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProductOption",
                "kind": "LinkedField",
                "name": "packageOptions",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v0/*: any*/),
                  (v7/*: any*/)
                ],
                "storageKey": null
              },
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProductOption",
                "kind": "LinkedField",
                "name": "payAsYouGoOption",
                "plural": false,
                "selections": [
                  (v0/*: any*/),
                  (v4/*: any*/),
                  (v7/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SubscriptionDetail",
        "kind": "LinkedField",
        "name": "subscription",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
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
                "kind": "ScalarField",
                "name": "paygOnly",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SubscriptionOptionDetail",
                "kind": "LinkedField",
                "name": "packageOptions",
                "plural": true,
                "selections": [
                  (v0/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "packageOptionId",
                    "storageKey": null
                  },
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "quantity",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "status",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "667e38c680ba1f9888717f5d0855f463",
    "id": null,
    "metadata": {},
    "name": "subscriptionSettingsViewQuery",
    "operationKind": "query",
    "text": "query subscriptionSettingsViewQuery {\n  billingPlan {\n    id\n    products {\n      id\n      name\n      packageOptions {\n        billingPeriod\n        id\n      }\n      unitSize\n      payAsYouGoOption {\n        id\n        price\n      }\n      ...devicePlanPickerProductFragment\n    }\n  }\n  subscription {\n    id\n    aiSpendCapUsd\n    usage {\n      activeDevices\n    }\n    products {\n      name\n      ...devicePlanPickerSubscriptionFragment\n    }\n  }\n}\n\nfragment devicePlanPickerProductFragment on Product {\n  id\n  name\n  unitSize\n  packageOptions {\n    id\n    billingPeriod\n    priceTiers {\n      from\n      upTo\n      unitPrice\n    }\n  }\n  payAsYouGoOption {\n    id\n    price\n    priceTiers {\n      from\n      upTo\n      unitPrice\n    }\n  }\n}\n\nfragment devicePlanPickerSubscriptionFragment on SubscriptionProductDetail {\n  paygOnly\n  packageOptions {\n    id\n    packageOptionId\n    billingPeriod\n    quantity\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "3e258f75bfff446fae69196ff27d7bd7";

export default node;
