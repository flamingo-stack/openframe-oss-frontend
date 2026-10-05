/**
 * @generated SignedSource<<873a891f48ee347adec7ec5b63e61ee2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type relayMentionChipsKbQuery$variables = {
  id: string;
};
export type relayMentionChipsKbQuery$data = {
  readonly knowledgeBaseItem: {
    readonly name: string;
  } | null | undefined;
};
export type relayMentionChipsKbQuery = {
  response: relayMentionChipsKbQuery$data;
  variables: relayMentionChipsKbQuery$variables;
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
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "relayMentionChipsKbQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "KnowledgeBaseItem",
        "kind": "LinkedField",
        "name": "knowledgeBaseItem",
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
    "name": "relayMentionChipsKbQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "KnowledgeBaseItem",
        "kind": "LinkedField",
        "name": "knowledgeBaseItem",
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
    "cacheID": "74b5622dbaa08d2a1ed04220018b5a00",
    "id": null,
    "metadata": {},
    "name": "relayMentionChipsKbQuery",
    "operationKind": "query",
    "text": "query relayMentionChipsKbQuery(\n  $id: ID!\n) {\n  knowledgeBaseItem(id: $id) {\n    name\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d7a048c6610e5d683e10c070ef135ca6";

export default node;
