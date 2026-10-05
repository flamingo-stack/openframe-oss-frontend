/**
 * @generated SignedSource<<e24a06adb76b90ad30994b60e5289464>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type NotificationCategory = "CUSTOMERS" | "DASHBOARD" | "DEVICES" | "GENERIC" | "INSIGHTS" | "LOGS" | "MINGO" | "MONITORING" | "SCRIPTS" | "SOFTWARE" | "TICKETS" | "%future added value";
export type unreadCountsRelayQuery$variables = Record<PropertyKey, never>;
export type unreadCountsRelayQuery$data = {
  readonly unreadCountsByCategory: ReadonlyArray<{
    readonly category: NotificationCategory;
    readonly count: number;
  }>;
};
export type unreadCountsRelayQuery = {
  response: unreadCountsRelayQuery$data;
  variables: unreadCountsRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UnreadCategoryCount",
    "kind": "LinkedField",
    "name": "unreadCountsByCategory",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "category",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "count",
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
    "name": "unreadCountsRelayQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "unreadCountsRelayQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "5c8d9faeaba3518f8812669b0c0b941d",
    "id": null,
    "metadata": {},
    "name": "unreadCountsRelayQuery",
    "operationKind": "query",
    "text": "query unreadCountsRelayQuery {\n  unreadCountsByCategory {\n    category\n    count\n  }\n}\n"
  }
};
})();

(node as any).hash = "6ceefaeab50014381ec37a5d03675982";

export default node;
