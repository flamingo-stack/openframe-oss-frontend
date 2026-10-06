/**
 * @generated SignedSource<<247a7db6ffe1ae43b8107ac8a7c1f92f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "UNCOLLECTIBLE" | "VOID" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type unpaidInvoicesScreenQuery$variables = Record<PropertyKey, never>;
export type unpaidInvoicesScreenQuery$data = {
  readonly subscription: {
    readonly id: string;
    readonly pendingInvoices: ReadonlyArray<{
      readonly amountDue: number;
      readonly createdAt: Instant;
      readonly dueDate: Instant | null | undefined;
      readonly hostedInvoiceUrl: string;
      readonly id: string;
      readonly invoiceNumber: string | null | undefined;
      readonly status: InvoiceStatus | null | undefined;
    }>;
  } | null | undefined;
};
export type unpaidInvoicesScreenQuery = {
  response: unpaidInvoicesScreenQuery$data;
  variables: unpaidInvoicesScreenQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
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
            "name": "amountDue",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "dueDate",
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
            "name": "hostedInvoiceUrl",
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
    "name": "unpaidInvoicesScreenQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "unpaidInvoicesScreenQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7dcd1a7988d3a9820cd3d1ee94940002",
    "id": null,
    "metadata": {},
    "name": "unpaidInvoicesScreenQuery",
    "operationKind": "query",
    "text": "query unpaidInvoicesScreenQuery {\n  subscription {\n    id\n    pendingInvoices {\n      id\n      invoiceNumber\n      status\n      amountDue\n      dueDate\n      createdAt\n      hostedInvoiceUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8ac25d99f7168b39aaa730397438bb30";

export default node;
