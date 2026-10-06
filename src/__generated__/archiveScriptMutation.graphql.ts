/**
 * @generated SignedSource<<c1f4be948f0091d7880da1143356f294>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type archiveScriptMutation$variables = {
  connections: ReadonlyArray<string>;
  id: string;
};
export type archiveScriptMutation$data = {
  readonly archiveScript: {
    readonly id: string;
    readonly status: ScriptStatus;
  };
};
export type archiveScriptMutation = {
  response: archiveScriptMutation$data;
  variables: archiveScriptMutation$variables;
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
    "name": "archiveScriptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "archiveScript",
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
    "name": "archiveScriptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "archiveScript",
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
    "cacheID": "c9b63bb851add158f273cdd19308d739",
    "id": null,
    "metadata": {},
    "name": "archiveScriptMutation",
    "operationKind": "mutation",
    "text": "mutation archiveScriptMutation(\n  $id: ID!\n) {\n  archiveScript(id: $id) {\n    id\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "b711133b9503f0a442489b352fe36f34";

export default node;
