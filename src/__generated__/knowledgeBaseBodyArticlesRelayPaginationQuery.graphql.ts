/**
 * @generated SignedSource<<91d487453cd5eee592726b948a4c50e0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type KnowledgeBaseItemType = "ARTICLE" | "FOLDER" | "%future added value";
export type KnowledgeBaseFilterInput = {
  parentId?: string | null | undefined;
  tagIds?: ReadonlyArray<string | null | undefined> | null | undefined;
  type?: KnowledgeBaseItemType | null | undefined;
};
export type knowledgeBaseBodyArticlesRelayPaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: KnowledgeBaseFilterInput | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type knowledgeBaseBodyArticlesRelayPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"knowledgeBaseBodyArticlesRelay_query">;
};
export type knowledgeBaseBodyArticlesRelayPaginationQuery = {
  response: knowledgeBaseBodyArticlesRelayPaginationQuery$data;
  variables: knowledgeBaseBodyArticlesRelayPaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": 20,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "search",
    "variableName": "search"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "knowledgeBaseBodyArticlesRelayPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "knowledgeBaseBodyArticlesRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "knowledgeBaseBodyArticlesRelayPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "KnowledgeBaseItemConnection",
        "kind": "LinkedField",
        "name": "knowledgeBaseItems",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "KnowledgeBaseItemEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "KnowledgeBaseItem",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
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
                    "name": "status",
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
                    "concreteType": "Tag",
                    "kind": "LinkedField",
                    "name": "tags",
                    "plural": true,
                    "selections": [
                      (v2/*: any*/),
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
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "filteredCount",
            "storageKey": null
          },
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__id",
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "knowledgeBaseBodyArticles__knowledgeBaseItems",
        "kind": "LinkedHandle",
        "name": "knowledgeBaseItems"
      }
    ]
  },
  "params": {
    "cacheID": "9b69d35fccaf67c88cad067bab7c1aa7",
    "id": null,
    "metadata": {},
    "name": "knowledgeBaseBodyArticlesRelayPaginationQuery",
    "operationKind": "query",
    "text": "query knowledgeBaseBodyArticlesRelayPaginationQuery(\n  $after: String\n  $filter: KnowledgeBaseFilterInput\n  $first: Int = 20\n  $search: String\n) {\n  ...knowledgeBaseBodyArticlesRelay_query_2zR4qx\n}\n\nfragment knowledgeBaseBodyArticlesRelay_query_2zR4qx on Query {\n  knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        ...knowledgeBaseTableRow_node\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    filteredCount\n  }\n}\n\nfragment knowledgeBaseTableRow_node on KnowledgeBaseItem {\n  id\n  type\n  name\n  parentId\n  status\n  summary\n  createdAt\n  updatedAt\n  tags {\n    id\n    key\n    color\n  }\n}\n"
  }
};
})();

(node as any).hash = "9b4ec3132b79ceb3ed2360aa79d80e54";

export default node;
