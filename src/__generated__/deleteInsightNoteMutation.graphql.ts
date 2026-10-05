/**
 * @generated SignedSource<<e68da758f7aad36ccf9e4ddea86085ca>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type InsightNoteIdInput = {
  id: string;
};
export type deleteInsightNoteMutation$variables = {
  connections: ReadonlyArray<string>;
  input: InsightNoteIdInput;
};
export type deleteInsightNoteMutation$data = {
  readonly deleteInsightNote: string;
};
export type deleteInsightNoteMutation = {
  response: deleteInsightNoteMutation$data;
  variables: deleteInsightNoteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": (v2/*: any*/),
  "kind": "ScalarField",
  "name": "deleteInsightNote",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "deleteInsightNoteMutation",
    "selections": [
      (v3/*: any*/)
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "deleteInsightNoteMutation",
    "selections": [
      (v3/*: any*/),
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "deleteEdge",
        "key": "",
        "kind": "ScalarHandle",
        "name": "deleteInsightNote",
        "handleArgs": [
          {
            "kind": "Variable",
            "name": "connections",
            "variableName": "connections"
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "ee40c87b8c723869b825d2951730941a",
    "id": null,
    "metadata": {},
    "name": "deleteInsightNoteMutation",
    "operationKind": "mutation",
    "text": "mutation deleteInsightNoteMutation(\n  $input: InsightNoteIdInput!\n) {\n  deleteInsightNote(input: $input)\n}\n"
  }
};
})();

(node as any).hash = "c54f834aa10496d1dc41a91c5fd3b903";

export default node;
