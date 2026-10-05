/**
 * @generated SignedSource<<bd6113177971aa989ea62b51bf610e2d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type KnowledgeBaseArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED" | "%future added value";
export type KnowledgeBaseItemType = "ARTICLE" | "FOLDER" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type CreateArticleInput = {
  assignedDeviceIds?: ReadonlyArray<string> | null | undefined;
  assignedKnowledgeArticleIds?: ReadonlyArray<string> | null | undefined;
  assignedOrganizationIds?: ReadonlyArray<string> | null | undefined;
  assignedTicketIds?: ReadonlyArray<string> | null | undefined;
  content?: string | null | undefined;
  name: string;
  parentId?: string | null | undefined;
  status?: KnowledgeBaseArticleStatus | null | undefined;
  summary?: string | null | undefined;
  tagIds?: ReadonlyArray<string> | null | undefined;
};
export type useCreateArticleMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateArticleInput;
};
export type useCreateArticleMutation$data = {
  readonly createArticle: {
    readonly author: {
      readonly email: string | null | undefined;
      readonly firstName: string | null | undefined;
      readonly id: string;
      readonly image: {
        readonly hash: string | null | undefined;
        readonly imageUrl: string | null | undefined;
      } | null | undefined;
      readonly lastName: string | null | undefined;
    } | null | undefined;
    readonly content: string | null | undefined;
    readonly createdAt: Instant | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly parentId: string | null | undefined;
    readonly publishedAt: Instant | null | undefined;
    readonly status: KnowledgeBaseArticleStatus | null | undefined;
    readonly summary: string | null | undefined;
    readonly tags: ReadonlyArray<{
      readonly color: string | null | undefined;
      readonly id: string;
      readonly key: string;
    }>;
    readonly type: KnowledgeBaseItemType;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type useCreateArticleMutation = {
  response: useCreateArticleMutation$data;
  variables: useCreateArticleMutation$variables;
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
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": (v2/*: any*/),
  "concreteType": "KnowledgeBaseItem",
  "kind": "LinkedField",
  "name": "createArticle",
  "plural": false,
  "selections": [
    (v3/*: any*/),
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
      "name": "summary",
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
      "name": "createdAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "updatedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "author",
      "plural": false,
      "selections": [
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "firstName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lastName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "email",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "UserImage",
          "kind": "LinkedField",
          "name": "image",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "imageUrl",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hash",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Tag",
      "kind": "LinkedField",
      "name": "tags",
      "plural": true,
      "selections": [
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "key",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "color",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useCreateArticleMutation",
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
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "useCreateArticleMutation",
    "selections": [
      (v4/*: any*/),
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "appendNode",
        "key": "",
        "kind": "LinkedHandle",
        "name": "createArticle",
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
    "cacheID": "eac46136d24d7889c82204da414fb70a",
    "id": null,
    "metadata": {},
    "name": "useCreateArticleMutation",
    "operationKind": "mutation",
    "text": "mutation useCreateArticleMutation(\n  $input: CreateArticleInput!\n) {\n  createArticle(input: $input) {\n    id\n    type\n    name\n    parentId\n    summary\n    content\n    status\n    publishedAt\n    createdAt\n    updatedAt\n    author {\n      id\n      firstName\n      lastName\n      email\n      image {\n        imageUrl\n        hash\n      }\n    }\n    tags {\n      id\n      key\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2977d3f577e96d65c691a0a6dc6840a5";

export default node;
