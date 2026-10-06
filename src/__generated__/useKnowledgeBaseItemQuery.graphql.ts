/**
 * @generated SignedSource<<2e05d55e7191449f66335e8c2ba6d264>>
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
import type { Long } from "../lib/graphql-scalars";
export type useKnowledgeBaseItemQuery$variables = {
  id: string;
};
export type useKnowledgeBaseItemQuery$data = {
  readonly knowledgeBaseItem: {
    readonly attachments: ReadonlyArray<{
      readonly contentType: string | null | undefined;
      readonly createdAt: Instant | null | undefined;
      readonly fileName: string;
      readonly fileSize: Long | null | undefined;
      readonly id: string;
    }>;
    readonly author: {
      readonly email: string | null | undefined;
      readonly firstName: string | null | undefined;
      readonly id: string;
      readonly image: {
        readonly hash: string | null | undefined;
        readonly imageUrl: string | null | undefined;
      } | null | undefined;
      readonly lastName: string | null | undefined;
      readonly status: string | null | undefined;
    } | null | undefined;
    readonly content: string | null | undefined;
    readonly createdAt: Instant | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly parentId: string | null | undefined;
    readonly publishedAt: Instant | null | undefined;
    readonly slug: string | null | undefined;
    readonly status: KnowledgeBaseArticleStatus | null | undefined;
    readonly summary: string | null | undefined;
    readonly tags: ReadonlyArray<{
      readonly color: string | null | undefined;
      readonly id: string;
      readonly key: string;
    }>;
    readonly type: KnowledgeBaseItemType;
    readonly updatedAt: Instant | null | undefined;
  } | null | undefined;
};
export type useKnowledgeBaseItemQuery = {
  response: useKnowledgeBaseItemQuery$data;
  variables: useKnowledgeBaseItemQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v4 = [
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
    "name": "knowledgeBaseItem",
    "plural": false,
    "selections": [
      (v1/*: any*/),
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
        "name": "slug",
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
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "publishedAt",
        "storageKey": null
      },
      (v3/*: any*/),
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
          (v1/*: any*/),
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
          (v2/*: any*/),
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
          (v1/*: any*/),
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "KnowledgeBaseItemAttachment",
        "kind": "LinkedField",
        "name": "attachments",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "fileName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "fileSize",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "contentType",
            "storageKey": null
          },
          (v3/*: any*/)
        ],
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
    "name": "useKnowledgeBaseItemQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useKnowledgeBaseItemQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "ddd0363e1248dab5b9384af1dbb24681",
    "id": null,
    "metadata": {},
    "name": "useKnowledgeBaseItemQuery",
    "operationKind": "query",
    "text": "query useKnowledgeBaseItemQuery(\n  $id: ID!\n) {\n  knowledgeBaseItem(id: $id) {\n    id\n    type\n    name\n    parentId\n    slug\n    content\n    summary\n    status\n    publishedAt\n    createdAt\n    updatedAt\n    author {\n      id\n      firstName\n      lastName\n      email\n      status\n      image {\n        imageUrl\n        hash\n      }\n    }\n    tags {\n      id\n      key\n      color\n    }\n    attachments {\n      id\n      fileName\n      fileSize\n      contentType\n      createdAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a5aa91a315d97081420b74de07c7abd1";

export default node;
