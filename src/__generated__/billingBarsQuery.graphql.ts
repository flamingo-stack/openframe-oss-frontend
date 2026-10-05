/**
 * @generated SignedSource<<e4f158e03c232eb452a5db56cc61edf3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "PENDING_CANCELLATION" | "SUSPENDED" | "TRIAL" | "TRIAL_EXPIRED" | "%future added value";
import type { LocalDate } from "../lib/graphql-scalars";
export type billingBarsQuery$variables = Record<PropertyKey, never>;
export type billingBarsQuery$data = {
  readonly subscription: {
    readonly aiSpendCapUsd: number | null | undefined;
    readonly id: string;
    readonly startDate: LocalDate | null | undefined;
    readonly status: SubscriptionStatus;
    readonly trialExpirationDate: LocalDate | null | undefined;
    readonly usage: {
      readonly aiSpendUsd: number;
    };
  } | null | undefined;
};
export type billingBarsQuery = {
  response: billingBarsQuery$data;
  variables: billingBarsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "SubscriptionDetail",
    "kind": "LinkedField",
    "name": "subscription",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "status",
        "storageKey": null
      },
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
        "name": "trialExpirationDate",
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
        "concreteType": "SubscriptionUsage",
        "kind": "LinkedField",
        "name": "usage",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "aiSpendUsd",
            "storageKey": null
          }
        ],
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
    "name": "billingBarsQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "billingBarsQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "4c0197366fcf63e0f3595012c0ad90e3",
    "id": null,
    "metadata": {},
    "name": "billingBarsQuery",
    "operationKind": "query",
    "text": "query billingBarsQuery {\n  subscription {\n    id\n    status\n    startDate\n    trialExpirationDate\n    aiSpendCapUsd\n    usage {\n      aiSpendUsd\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "532ad0701c91acacc63a03761ce55849";

export default node;
