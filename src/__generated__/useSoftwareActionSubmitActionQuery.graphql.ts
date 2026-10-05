/**
 * @generated SignedSource<<62ee877d68856a614e8c1a7e0ff1e973>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useSoftwareActionSubmitActionQuery$variables = {
  id: string;
};
export type useSoftwareActionSubmitActionQuery$data = {
  readonly softwareAction: {
    readonly id: string;
  } | null | undefined;
};
export type useSoftwareActionSubmitActionQuery = {
  response: useSoftwareActionSubmitActionQuery$data;
  variables: useSoftwareActionSubmitActionQuery$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "SoftwareActionRun",
    "kind": "LinkedField",
    "name": "softwareAction",
    "plural": false,
    "selections": [
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useSoftwareActionSubmitActionQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useSoftwareActionSubmitActionQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a25f1e30d10a72097940a5b61b007201",
    "id": null,
    "metadata": {},
    "name": "useSoftwareActionSubmitActionQuery",
    "operationKind": "query",
    "text": "query useSoftwareActionSubmitActionQuery(\n  $id: ID!\n) {\n  softwareAction(id: $id) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "54fe22482ff9489b91ed17df912342ae";

export default node;
