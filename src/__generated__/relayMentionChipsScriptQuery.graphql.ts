/**
 * @generated SignedSource<<7c73959b3767f7ce32d24cb5446737e8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type relayMentionChipsScriptQuery$variables = {
  id: string;
};
export type relayMentionChipsScriptQuery$data = {
  readonly script: {
    readonly name: string;
  };
};
export type relayMentionChipsScriptQuery = {
  response: relayMentionChipsScriptQuery$data;
  variables: relayMentionChipsScriptQuery$variables;
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
    "name": "relayMentionChipsScriptQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "script",
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
    "name": "relayMentionChipsScriptQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "script",
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
    "cacheID": "f92ef78d4e648206d9a89c842c76d0cc",
    "id": null,
    "metadata": {},
    "name": "relayMentionChipsScriptQuery",
    "operationKind": "query",
    "text": "query relayMentionChipsScriptQuery(\n  $id: ID!\n) {\n  script(id: $id) {\n    name\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0689dfbae089ec59274e4acc6df51db4";

export default node;
