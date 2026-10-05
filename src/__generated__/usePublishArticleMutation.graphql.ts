/**
 * @generated SignedSource<<c27cbbbca847ce9ccf569472e8275f6e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type KnowledgeBaseArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type usePublishArticleMutation$variables = {
  id: string;
};
export type usePublishArticleMutation$data = {
  readonly publishArticle: {
    readonly id: string;
    readonly publishedAt: Instant | null | undefined;
    readonly status: KnowledgeBaseArticleStatus | null | undefined;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type usePublishArticleMutation = {
  response: usePublishArticleMutation$data;
  variables: usePublishArticleMutation$variables;
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
    "name": "publishArticle",
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
    "name": "usePublishArticleMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "usePublishArticleMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "2a8d06612dbd82856369e31882c323d5",
    "id": null,
    "metadata": {},
    "name": "usePublishArticleMutation",
    "operationKind": "mutation",
    "text": "mutation usePublishArticleMutation(\n  $id: ID!\n) {\n  publishArticle(id: $id) {\n    id\n    status\n    publishedAt\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "7649948e8eb6a8fe2ab666dd7d643111";

export default node;
