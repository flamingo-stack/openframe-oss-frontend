/**
 * @generated SignedSource<<aedb9d7df44d5524cde10b4bd2bd771f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type InsightStatus = "ACKNOWLEDGED" | "ARCHIVED" | "NEW" | "RESOLVED" | "SNOOZED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type InsightIdInput = {
  id: string;
};
export type acknowledgeInsightMutation$variables = {
  input: InsightIdInput;
};
export type acknowledgeInsightMutation$data = {
  readonly acknowledgeInsight: {
    readonly id: string;
    readonly snoozedUntil: Instant | null | undefined;
    readonly status: InsightStatus;
  };
};
export type acknowledgeInsightMutation = {
  response: acknowledgeInsightMutation$data;
  variables: acknowledgeInsightMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "Insight",
    "kind": "LinkedField",
    "name": "acknowledgeInsight",
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
        "name": "snoozedUntil",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "acknowledgeInsightMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "acknowledgeInsightMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1885f7dd5bdcb552825df3887c50c67f",
    "id": null,
    "metadata": {},
    "name": "acknowledgeInsightMutation",
    "operationKind": "mutation",
    "text": "mutation acknowledgeInsightMutation(\n  $input: InsightIdInput!\n) {\n  acknowledgeInsight(input: $input) {\n    id\n    status\n    snoozedUntil\n  }\n}\n"
  }
};
})();

(node as any).hash = "67b0cf05f33cc5c7004454ff4d11a690";

export default node;
