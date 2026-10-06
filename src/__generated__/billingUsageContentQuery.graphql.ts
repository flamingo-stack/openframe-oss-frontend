/**
 * @generated SignedSource<<d8c42a105a2193f13f501979acf44f83>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type BillingPeriod = "MONTHLY" | "YEARLY" | "%future added value";
export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "UNCOLLECTIBLE" | "VOID" | "%future added value";
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
export type SubscriptionProductStatus = "ACTIVE" | "EXPIRED" | "PENDING_ACTIVATION" | "%future added value";
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "PENDING_CANCELLATION" | "SUSPENDED" | "TRIAL" | "TRIAL_EXPIRED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { LocalDate } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type billingUsageContentQuery$variables = Record<PropertyKey, never>;
export type billingUsageContentQuery$data = {
  readonly billingPlan: {
    readonly id: string;
    readonly products: ReadonlyArray<{
      readonly id: string;
      readonly name: OpenframeProduct;
      readonly packageOptions: ReadonlyArray<{
        readonly billingPeriod: BillingPeriod | null | undefined;
        readonly id: string;
        readonly price: number | null | undefined;
        readonly priceTiers: ReadonlyArray<{
          readonly from: number;
          readonly unitPrice: number;
          readonly upTo: number | null | undefined;
        }> | null | undefined;
      }>;
      readonly payAsYouGoOption: {
        readonly id: string;
        readonly price: number | null | undefined;
        readonly priceTiers: ReadonlyArray<{
          readonly from: number;
          readonly unitPrice: number;
          readonly upTo: number | null | undefined;
        }> | null | undefined;
      } | null | undefined;
      readonly unitSize: Long | null | undefined;
    }>;
  } | null | undefined;
  readonly subscription: {
    readonly aiSpendCapUsd: number | null | undefined;
    readonly cancellationEffectiveAt: LocalDate | null | undefined;
    readonly currentInvoice: {
      readonly estimatedOverage: Long;
    } | null | undefined;
    readonly currentPeriodEnd: LocalDate | null | undefined;
    readonly id: string;
    readonly nextPayment: number | null | undefined;
    readonly pendingInvoices: ReadonlyArray<{
      readonly amountDue: number;
      readonly createdAt: Instant;
      readonly dueDate: Instant | null | undefined;
      readonly hostedInvoiceUrl: string;
      readonly id: string;
      readonly invoiceNumber: string | null | undefined;
      readonly status: InvoiceStatus | null | undefined;
    }>;
    readonly products: ReadonlyArray<{
      readonly name: OpenframeProduct;
      readonly packageOptions: ReadonlyArray<{
        readonly billingPeriod: BillingPeriod | null | undefined;
        readonly endDate: LocalDate | null | undefined;
        readonly id: string;
        readonly price: number | null | undefined;
        readonly quantity: number | null | undefined;
        readonly startDate: LocalDate | null | undefined;
        readonly status: SubscriptionProductStatus | null | undefined;
      }>;
      readonly payAsYouGoOption: {
        readonly id: string;
        readonly price: number | null | undefined;
      } | null | undefined;
    }>;
    readonly status: SubscriptionStatus;
    readonly trialExpirationDate: LocalDate | null | undefined;
    readonly usage: {
      readonly activeDevices: number;
      readonly aiSpendUsd: number;
      readonly aiTokensFree: Long;
      readonly aiTokensFreeUsed: Long;
      readonly aiTokensOverage: Long;
      readonly devicesUsed: number;
    };
  } | null | undefined;
};
export type billingUsageContentQuery = {
  response: billingUsageContentQuery$data;
  variables: billingUsageContentQuery$variables;
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
  "name": "price",
  "storageKey": null
},
v4 = {
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
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v6 = [
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
              (v3/*: any*/),
              (v4/*: any*/)
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
              (v3/*: any*/),
              (v4/*: any*/)
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
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "currentPeriodEnd",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "cancellationEffectiveAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "trialExpirationDate",
        "storageKey": null
      },
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
              (v0/*: any*/),
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "quantity",
                "storageKey": null
              },
              (v3/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "startDate",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endDate",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "SubscriptionOptionDetail",
            "kind": "LinkedField",
            "name": "payAsYouGoOption",
            "plural": false,
            "selections": [
              (v0/*: any*/),
              (v3/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "PendingInvoice",
        "kind": "LinkedField",
        "name": "pendingInvoices",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "invoiceNumber",
            "storageKey": null
          },
          (v5/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hostedInvoiceUrl",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "amountDue",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "dueDate",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
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
            "name": "aiTokensFree",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "aiTokensFreeUsed",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "aiTokensOverage",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "aiSpendUsd",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "aiSpendCapUsd",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "InvoiceSummary",
        "kind": "LinkedField",
        "name": "currentInvoice",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "estimatedOverage",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "nextPayment",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "billingUsageContentQuery",
    "selections": (v6/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "billingUsageContentQuery",
    "selections": (v6/*: any*/)
  },
  "params": {
    "cacheID": "4f1d6fbbd338763a3b9c8b36303b7f58",
    "id": null,
    "metadata": {},
    "name": "billingUsageContentQuery",
    "operationKind": "query",
    "text": "query billingUsageContentQuery {\n  billingPlan {\n    id\n    products {\n      id\n      name\n      unitSize\n      packageOptions {\n        id\n        billingPeriod\n        price\n        priceTiers {\n          from\n          upTo\n          unitPrice\n        }\n      }\n      payAsYouGoOption {\n        id\n        price\n        priceTiers {\n          from\n          upTo\n          unitPrice\n        }\n      }\n    }\n  }\n  subscription {\n    id\n    status\n    currentPeriodEnd\n    cancellationEffectiveAt\n    trialExpirationDate\n    products {\n      name\n      packageOptions {\n        id\n        billingPeriod\n        quantity\n        price\n        status\n        startDate\n        endDate\n      }\n      payAsYouGoOption {\n        id\n        price\n      }\n    }\n    pendingInvoices {\n      id\n      invoiceNumber\n      status\n      hostedInvoiceUrl\n      amountDue\n      createdAt\n      dueDate\n    }\n    usage {\n      devicesUsed\n      activeDevices\n      aiTokensFree\n      aiTokensFreeUsed\n      aiTokensOverage\n      aiSpendUsd\n    }\n    aiSpendCapUsd\n    currentInvoice {\n      estimatedOverage\n    }\n    nextPayment\n  }\n}\n"
  }
};
})();

(node as any).hash = "faa3b0a706354ac714934e39ed310501";

export default node;
