/**
 * @generated SignedSource<<35b191933e33c1ffd2810c65920d0cf3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type KnowledgeBaseArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useUnpublishArticleMutation$variables = {
  id: string;
};
export type useUnpublishArticleMutation$data = {
  readonly unpublishArticle: {
    readonly id: string;
    readonly publishedAt: Instant | null | undefined;
    readonly status: KnowledgeBaseArticleStatus | null | undefined;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useUnpublishArticleMutation = {
  response: useUnpublishArticleMutation$data;
  variables: useUnpublishArticleMutation$variables;
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
    "concreteType": "KnowledgeBaseItem",
    "kind": "LinkedField",
    "name": "unpublishArticle",
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
        "name": "publishedAt",
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
    "name": "useUnpublishArticleMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useUnpublishArticleMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7054bcb46552a813b698eca9d6873ff2",
    "id": null,
    "metadata": {},
    "name": "useUnpublishArticleMutation",
    "operationKind": "mutation",
    "text": "mutation useUnpublishArticleMutation(\n  $id: ID!\n) {\n  unpublishArticle(id: $id) {\n    id\n    status\n    publishedAt\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "c6739bb8f4e5e14088e41d0dac4d8e32";

export default node;
