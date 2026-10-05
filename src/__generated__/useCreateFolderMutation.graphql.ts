/**
 * @generated SignedSource<<dbf9b6262de5d711aab1804e6abc9d9f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type KnowledgeBaseItemType = "ARTICLE" | "FOLDER" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useCreateFolderMutation$variables = {
  connections: ReadonlyArray<string>;
  name: string;
  parentId?: string | null | undefined;
};
export type useCreateFolderMutation$data = {
  readonly createFolder: {
    readonly createdAt: Instant | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly parentId: string | null | undefined;
    readonly type: KnowledgeBaseItemType;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useCreateFolderMutation = {
  response: useCreateFolderMutation$data;
  variables: useCreateFolderMutation$variables;
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
  "name": "name"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "parentId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "name",
    "variableName": "name"
  },
  {
    "kind": "Variable",
    "name": "parentId",
    "variableName": "parentId"
  }
],
v4 = {
  "alias": null,
  "args": (v3/*: any*/),
  "concreteType": "KnowledgeBaseItem",
  "kind": "LinkedField",
  "name": "createFolder",
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
      "name": "type",
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
      "name": "parentId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useCreateFolderMutation",
    "selections": [
      (v4/*: any*/)
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "useCreateFolderMutation",
    "selections": [
      (v4/*: any*/),
      {
        "alias": null,
        "args": (v3/*: any*/),
        "filters": null,
        "handle": "appendNode",
        "key": "",
        "kind": "LinkedHandle",
        "name": "createFolder",
        "handleArgs": [
          {
            "kind": "Variable",
            "name": "connections",
            "variableName": "connections"
          },
          {
            "kind": "Literal",
            "name": "edgeTypeName",
            "value": "KnowledgeBaseItemEdge"
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "fbcec8efbece78c1912855ce6b281d31",
    "id": null,
    "metadata": {},
    "name": "useCreateFolderMutation",
    "operationKind": "mutation",
    "text": "mutation useCreateFolderMutation(\n  $name: String!\n  $parentId: ID\n) {\n  createFolder(name: $name, parentId: $parentId) {\n    id\n    type\n    name\n    parentId\n    createdAt\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "11b781bfb9790b5aa4a4804a7634c56d";

export default node;
