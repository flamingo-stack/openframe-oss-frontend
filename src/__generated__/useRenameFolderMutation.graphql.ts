/**
 * @generated SignedSource<<71c5168819b3d759405bb68a07c2b8c9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
export type useRenameFolderMutation$variables = {
  id: string;
  name: string;
};
export type useRenameFolderMutation$data = {
  readonly renameFolder: {
    readonly id: string;
    readonly name: string;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useRenameFolderMutation = {
  response: useRenameFolderMutation$data;
  variables: useRenameFolderMutation$variables;
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
    "name": "name"
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
        "name": "name",
        "variableName": "name"
      }
    ],
    "concreteType": "KnowledgeBaseItem",
    "kind": "LinkedField",
    "name": "renameFolder",
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
        "name": "name",
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
    "name": "useRenameFolderMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useRenameFolderMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "716e03cc890d3b7086a5505d12d83788",
    "id": null,
    "metadata": {},
    "name": "useRenameFolderMutation",
    "operationKind": "mutation",
    "text": "mutation useRenameFolderMutation(\n  $id: ID!\n  $name: String!\n) {\n  renameFolder(id: $id, name: $name) {\n    id\n    name\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "1ee04ad0d62c1a6984fe8fc0b450ebb3";

export default node;
