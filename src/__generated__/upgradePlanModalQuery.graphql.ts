/**
 * @generated SignedSource<<2965e1f8a5145321f22a4828fe62d8ad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
export type upgradePlanModalQuery$variables = Record<PropertyKey, never>;
export type upgradePlanModalQuery$data = {
  readonly billingPlan: {
    readonly id: string;
    readonly products: ReadonlyArray<{
      readonly id: string;
      readonly name: OpenframeProduct;
      readonly " $fragmentSpreads": FragmentRefs<"devicePlanPickerProductFragment">;
    }>;
  } | null | undefined;
  readonly subscription: {
    readonly id: string;
    readonly products: ReadonlyArray<{
      readonly name: OpenframeProduct;
      readonly " $fragmentSpreads": FragmentRefs<"devicePlanPickerSubscriptionFragment">;
    }>;
  } | null | undefined;
};
export type upgradePlanModalQuery = {
  response: upgradePlanModalQuery$data;
  variables: upgradePlanModalQuery$variables;
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
    "name": "upgradePlanModalQuery",
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
    "name": "upgradePlanModalQuery",
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
                "kind": "ScalarField",
                "name": "unitSize",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ProductOption",
                "kind": "LinkedField",
                "name": "packageOptions",
                "plural": true,
                "selections": [
                  (v0/*: any*/),
                  (v2/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ProductOption",
                "kind": "LinkedField",
                "name": "payAsYouGoOption",
                "plural": false,
                "selections": [
                  (v0/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "price",
                    "storageKey": null
                  },
                  (v3/*: any*/)
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
    "cacheID": "5c39a17b85f98985d8808c38b3a576b8",
    "id": null,
    "metadata": {},
    "name": "upgradePlanModalQuery",
    "operationKind": "query",
    "text": "query upgradePlanModalQuery {\n  billingPlan {\n    id\n    products {\n      id\n      name\n      ...devicePlanPickerProductFragment\n    }\n  }\n  subscription {\n    id\n    products {\n      name\n      ...devicePlanPickerSubscriptionFragment\n    }\n  }\n}\n\nfragment devicePlanPickerProductFragment on Product {\n  id\n  name\n  unitSize\n  packageOptions {\n    id\n    billingPeriod\n    priceTiers {\n      from\n      upTo\n      unitPrice\n    }\n  }\n  payAsYouGoOption {\n    id\n    price\n    priceTiers {\n      from\n      upTo\n      unitPrice\n    }\n  }\n}\n\nfragment devicePlanPickerSubscriptionFragment on SubscriptionProductDetail {\n  paygOnly\n  packageOptions {\n    id\n    packageOptionId\n    billingPeriod\n    quantity\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "bdcde9a16d1d2e7c0a9a791bd6308e38";

export default node;
