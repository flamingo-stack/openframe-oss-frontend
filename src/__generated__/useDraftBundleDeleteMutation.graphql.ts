/**
 * @generated SignedSource<<6871712b1b133de8cf6a088111538d1b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useDraftBundleDeleteMutation$variables = {
  id: string;
};
export type useDraftBundleDeleteMutation$data = {
  readonly deleteSoftwareBundle: boolean;
};
export type useDraftBundleDeleteMutation = {
  response: useDraftBundleDeleteMutation$data;
  variables: useDraftBundleDeleteMutation$variables;
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
    "kind": "ScalarField",
    "name": "deleteSoftwareBundle",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useDraftBundleDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useDraftBundleDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bc48579c18f6dc513caa1e3cd4062f1c",
    "id": null,
    "metadata": {},
    "name": "useDraftBundleDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation useDraftBundleDeleteMutation(\n  $id: ID!\n) {\n  deleteSoftwareBundle(id: $id)\n}\n"
  }
};
})();

(node as any).hash = "f7ecc8778df5f93bc405c9c8439ae76f";

export default node;
