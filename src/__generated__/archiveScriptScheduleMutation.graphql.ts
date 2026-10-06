/**
 * @generated SignedSource<<db2d420399af969460e0eb3a68c2d4ee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type archiveScriptScheduleMutation$variables = {
  connections: ReadonlyArray<string>;
  id: string;
};
export type archiveScriptScheduleMutation$data = {
  readonly archiveScriptSchedule: {
    readonly id: string;
    readonly status: ScriptStatus;
  };
};
export type archiveScriptScheduleMutation = {
  response: archiveScriptScheduleMutation$data;
  variables: archiveScriptScheduleMutation$variables;
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
    "name": "archiveScriptScheduleMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "archiveScriptSchedule",
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
    "name": "archiveScriptScheduleMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "archiveScriptSchedule",
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
    "cacheID": "bc5ed3ce4e4de35be490d1679d54d40c",
    "id": null,
    "metadata": {},
    "name": "archiveScriptScheduleMutation",
    "operationKind": "mutation",
    "text": "mutation archiveScriptScheduleMutation(\n  $id: ID!\n) {\n  archiveScriptSchedule(id: $id) {\n    id\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "161a46ac5d787f2b10a754fe486dce2b";

export default node;
