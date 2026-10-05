/**
 * @generated SignedSource<<d1a181fb13d4b8855f7f0128eff1d931>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type unarchiveScriptMutation$variables = {
  connections: ReadonlyArray<string>;
  id: string;
};
export type unarchiveScriptMutation$data = {
  readonly unarchiveScript: {
    readonly id: string;
    readonly status: ScriptStatus;
  };
};
export type unarchiveScriptMutation = {
  response: unarchiveScriptMutation$data;
  variables: unarchiveScriptMutation$variables;
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
    "name": "unarchiveScriptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "unarchiveScript",
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
    "name": "unarchiveScriptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "unarchiveScript",
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
    "cacheID": "f8eecf3067ea401758b19f2d472ff383",
    "id": null,
    "metadata": {},
    "name": "unarchiveScriptMutation",
    "operationKind": "mutation",
    "text": "mutation unarchiveScriptMutation(\n  $id: ID!\n) {\n  unarchiveScript(id: $id) {\n    id\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "c2e3ebfc26b717e2d18521d72a713d39";

export default node;
