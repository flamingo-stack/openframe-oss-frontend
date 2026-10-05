/**
 * @generated SignedSource<<18f89844e93b6b64f4401f0cf2d78ab9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type relayMentionChipsSoftwareQuery$variables = {
  id: string;
};
export type relayMentionChipsSoftwareQuery$data = {
  readonly software: {
    readonly name: string;
  } | null | undefined;
};
export type relayMentionChipsSoftwareQuery = {
  response: relayMentionChipsSoftwareQuery$data;
  variables: relayMentionChipsSoftwareQuery$variables;
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
    "name": "relayMentionChipsSoftwareQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Software",
        "kind": "LinkedField",
        "name": "software",
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
    "name": "relayMentionChipsSoftwareQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Software",
        "kind": "LinkedField",
        "name": "software",
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
    "cacheID": "09043bc467ecfbc02dc8187c7dd2d099",
    "id": null,
    "metadata": {},
    "name": "relayMentionChipsSoftwareQuery",
    "operationKind": "query",
    "text": "query relayMentionChipsSoftwareQuery(\n  $id: ID!\n) {\n  software(id: $id) {\n    name\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "45d207129715272897363a0a8581299a";

export default node;
