/**
 * @generated SignedSource<<26bc1ba4b2ef1a167167f603bb6e04a2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useTagMutations_DeleteTagMutation$variables = {
  id: string;
};
export type useTagMutations_DeleteTagMutation$data = {
  readonly deleteTag: boolean;
};
export type useTagMutations_DeleteTagMutation = {
  response: useTagMutations_DeleteTagMutation$data;
  variables: useTagMutations_DeleteTagMutation$variables;
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
    "name": "deleteTag",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useTagMutations_DeleteTagMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useTagMutations_DeleteTagMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fdc80237f04f93558752a8d7b93e846d",
    "id": null,
    "metadata": {},
    "name": "useTagMutations_DeleteTagMutation",
    "operationKind": "mutation",
    "text": "mutation useTagMutations_DeleteTagMutation(\n  $id: ID!\n) {\n  deleteTag(id: $id)\n}\n"
  }
};
})();

(node as any).hash = "260d0adc4ebcecb8d4fadb080ac31d9f";

export default node;
