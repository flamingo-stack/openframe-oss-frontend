/**
 * @generated SignedSource<<757eb3a55f398c45d493edda6b7e0c73>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type KnowledgeBaseArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useArchiveArticleMutation$variables = {
  id: string;
};
export type useArchiveArticleMutation$data = {
  readonly archiveArticle: {
    readonly id: string;
    readonly parentId: string | null | undefined;
    readonly status: KnowledgeBaseArticleStatus | null | undefined;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useArchiveArticleMutation = {
  response: useArchiveArticleMutation$data;
  variables: useArchiveArticleMutation$variables;
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
    "name": "archiveArticle",
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
    "name": "useArchiveArticleMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useArchiveArticleMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bb72cb64f7e604a24ec8ba958ad63a15",
    "id": null,
    "metadata": {},
    "name": "useArchiveArticleMutation",
    "operationKind": "mutation",
    "text": "mutation useArchiveArticleMutation(\n  $id: ID!\n) {\n  archiveArticle(id: $id) {\n    id\n    status\n    parentId\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "e5d5206bbd4f3c47d7cab8367e215044";

export default node;
