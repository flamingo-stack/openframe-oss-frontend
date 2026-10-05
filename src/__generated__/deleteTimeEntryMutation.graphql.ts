/**
 * @generated SignedSource<<0732f75ae97c7b9bfc84377134a789c3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type deleteTimeEntryMutation$variables = {
  id: string;
};
export type deleteTimeEntryMutation$data = {
  readonly deleteTimeEntry: boolean;
};
export type deleteTimeEntryMutation = {
  response: deleteTimeEntryMutation$data;
  variables: deleteTimeEntryMutation$variables;
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
    "name": "deleteTimeEntry",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "deleteTimeEntryMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deleteTimeEntryMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "77da810f8eb19b5cdadd896ba0a9b524",
    "id": null,
    "metadata": {},
    "name": "deleteTimeEntryMutation",
    "operationKind": "mutation",
    "text": "mutation deleteTimeEntryMutation(\n  $id: ID!\n) {\n  deleteTimeEntry(id: $id)\n}\n"
  }
};
})();

(node as any).hash = "21d5cd9e9471ff6889b6f11c6d8711f2";

export default node;
