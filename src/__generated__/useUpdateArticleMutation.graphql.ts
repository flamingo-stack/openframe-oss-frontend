/**
 * @generated SignedSource<<9ca6c2054e7fd28a8322497964a1c3eb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
export type UpdateArticleInput = {
  content?: string | null | undefined;
  id: string;
  name?: string | null | undefined;
  parentId?: string | null | undefined;
  summary?: string | null | undefined;
};
export type useUpdateArticleMutation$variables = {
  input: UpdateArticleInput;
};
export type useUpdateArticleMutation$data = {
  readonly updateArticle: {
    readonly content: string | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly parentId: string | null | undefined;
    readonly summary: string | null | undefined;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useUpdateArticleMutation = {
  response: useUpdateArticleMutation$data;
  variables: useUpdateArticleMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "KnowledgeBaseItem",
    "kind": "LinkedField",
    "name": "updateArticle",
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
        "name": "parentId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "content",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "summary",
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
    "name": "useUpdateArticleMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useUpdateArticleMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "38c14be213a2d2e6477fcf03588414b5",
    "id": null,
    "metadata": {},
    "name": "useUpdateArticleMutation",
    "operationKind": "mutation",
    "text": "mutation useUpdateArticleMutation(\n  $input: UpdateArticleInput!\n) {\n  updateArticle(input: $input) {\n    id\n    name\n    parentId\n    content\n    summary\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "605e87590a3205e5f1e2efc019477d48";

export default node;
