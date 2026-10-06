/**
 * @generated SignedSource<<7ef2d65d845c28d5af25b0bb5d76c7fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "PENDING_CANCELLATION" | "SUSPENDED" | "TRIAL" | "TRIAL_EXPIRED" | "%future added value";
export type subscriptionGuardQuery$variables = Record<PropertyKey, never>;
export type subscriptionGuardQuery$data = {
  readonly subscription: {
    readonly id: string;
    readonly status: SubscriptionStatus;
  } | null | undefined;
};
export type subscriptionGuardQuery = {
  response: subscriptionGuardQuery$data;
  variables: subscriptionGuardQuery$variables;
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
    "name": "subscriptionGuardQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "subscriptionGuardQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "5ee3ca29f3bcedabe37f88282506ad1e",
    "id": null,
    "metadata": {},
    "name": "subscriptionGuardQuery",
    "operationKind": "query",
    "text": "query subscriptionGuardQuery {\n  subscription {\n    id\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "6fc696ceba8cda574153850a2e4e2747";

export default node;
