/**
 * @generated SignedSource<<ecf3669e2aae3f0afe0049e412b89273>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type unarchiveScriptScheduleMutation$variables = {
  connections: ReadonlyArray<string>;
  id: string;
};
export type unarchiveScriptScheduleMutation$data = {
  readonly unarchiveScriptSchedule: {
    readonly id: string;
    readonly status: ScriptStatus;
  };
};
export type unarchiveScriptScheduleMutation = {
  response: unarchiveScriptScheduleMutation$data;
  variables: unarchiveScriptScheduleMutation$variables;
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
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
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
    "name": "unarchiveScriptScheduleMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "unarchiveScriptSchedule",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
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
    "name": "unarchiveScriptScheduleMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "unarchiveScriptSchedule",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "id",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              }
            ]
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2bdc2046777af45e7b554e6cf04bbf79",
    "id": null,
    "metadata": {},
    "name": "unarchiveScriptScheduleMutation",
    "operationKind": "mutation",
    "text": "mutation unarchiveScriptScheduleMutation(\n  $id: ID!\n) {\n  unarchiveScriptSchedule(id: $id) {\n    id\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "73acb98e18b399cb7143b2b0f2fc22ae";

export default node;
