/**
 * @generated SignedSource<<92af630c07f0d979f9f6ef00b27a288f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type InsightIdInput = {
  id: string;
};
export type unassignInsightMutation$variables = {
  input: InsightIdInput;
};
export type unassignInsightMutation$data = {
  readonly unassignInsight: {
    readonly assignee: {
      readonly id: string;
    } | null | undefined;
    readonly assigneeId: string | null | undefined;
    readonly id: string;
  };
};
export type unassignInsightMutation = {
  response: unassignInsightMutation$data;
  variables: unassignInsightMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
    "name": "unassignInsight",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "assigneeId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "assignee",
        "plural": false,
        "selections": [
          (v1/*: any*/)
        ],
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
    "name": "unassignInsightMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "unassignInsightMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "ffc1f58d4d62176d057d7c2ae7493e8e",
    "id": null,
    "metadata": {},
    "name": "unassignInsightMutation",
    "operationKind": "mutation",
    "text": "mutation unassignInsightMutation(\n  $input: InsightIdInput!\n) {\n  unassignInsight(input: $input) {\n    id\n    assigneeId\n    assignee {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1e9025e25c9d18529c65962901dd2a8b";

export default node;
