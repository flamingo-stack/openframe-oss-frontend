/**
 * @generated SignedSource<<fe47dc3d7aaa77bd6f8559e7e55529fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type KnowledgeBaseArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useUnarchiveArticleMutation$variables = {
  id: string;
  parentId?: string | null | undefined;
};
export type useUnarchiveArticleMutation$data = {
  readonly unarchiveArticle: {
    readonly id: string;
    readonly parentId: string | null | undefined;
    readonly status: KnowledgeBaseArticleStatus | null | undefined;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useUnarchiveArticleMutation = {
  response: useUnarchiveArticleMutation$data;
  variables: useUnarchiveArticleMutation$variables;
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
    "name": "unarchiveArticle",
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
        "name": "status",
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
    "name": "useUnarchiveArticleMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useUnarchiveArticleMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "edb7cef6159b0bfeca6cee0bf2a77f29",
    "id": null,
    "metadata": {},
    "name": "useUnarchiveArticleMutation",
    "operationKind": "mutation",
    "text": "mutation useUnarchiveArticleMutation(\n  $id: ID!\n  $parentId: ID\n) {\n  unarchiveArticle(id: $id, parentId: $parentId) {\n    id\n    status\n    parentId\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "6ff01a11dedfed9ed32021a9c52ce586";

export default node;
