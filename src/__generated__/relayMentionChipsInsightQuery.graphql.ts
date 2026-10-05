/**
 * @generated SignedSource<<fcfd84a077c6ca98de42426c7bc2ab18>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type relayMentionChipsInsightQuery$variables = {
  id: string;
};
export type relayMentionChipsInsightQuery$data = {
  readonly insight: {
    readonly title: string;
  };
};
export type relayMentionChipsInsightQuery = {
  response: relayMentionChipsInsightQuery$data;
  variables: relayMentionChipsInsightQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "title",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "relayMentionChipsInsightQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Insight",
        "kind": "LinkedField",
        "name": "insight",
        "plural": false,
        "selections": [
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "relayMentionChipsInsightQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Insight",
        "kind": "LinkedField",
        "name": "insight",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f7c124a1ea8e08c0f9282e9eaa681e5f",
    "id": null,
    "metadata": {},
    "name": "relayMentionChipsInsightQuery",
    "operationKind": "query",
    "text": "query relayMentionChipsInsightQuery(\n  $id: ID!\n) {\n  insight(id: $id) {\n    title\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d4ca246e38bd2f376a5b2d04e8097031";

export default node;
