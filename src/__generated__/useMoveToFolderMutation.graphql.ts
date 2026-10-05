/**
 * @generated SignedSource<<a3079619e09bfcee9e018fa1f4893a45>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
export type useMoveToFolderMutation$variables = {
  id: string;
  parentId?: string | null | undefined;
};
export type useMoveToFolderMutation$data = {
  readonly moveToFolder: {
    readonly id: string;
    readonly parentId: string | null | undefined;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useMoveToFolderMutation = {
  response: useMoveToFolderMutation$data;
  variables: useMoveToFolderMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "parentId"
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
      },
      {
        "kind": "Variable",
        "name": "parentId",
        "variableName": "parentId"
      }
    ],
    "concreteType": "KnowledgeBaseItem",
    "kind": "LinkedField",
    "name": "moveToFolder",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "parentId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "updatedAt",
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
    "name": "useMoveToFolderMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useMoveToFolderMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "194c4095d321655c0a1a76532e7b4938",
    "id": null,
    "metadata": {},
    "name": "useMoveToFolderMutation",
    "operationKind": "mutation",
    "text": "mutation useMoveToFolderMutation(\n  $id: ID!\n  $parentId: ID\n) {\n  moveToFolder(id: $id, parentId: $parentId) {\n    id\n    parentId\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "0c43bfde611b8b500f441679e0459a3b";

export default node;
