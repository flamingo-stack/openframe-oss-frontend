/**
 * @generated SignedSource<<b0df842643e1d3af727346117ffad2ac>>
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
export type knowledgeBaseBodySubtreeRelayQuery$variables = {
  after?: string | null | undefined;
  filter?: KnowledgeBaseFilterInput | null | undefined;
  first: number;
  search?: string | null | undefined;
};
export type knowledgeBaseBodySubtreeRelayQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"knowledgeBaseBodySubtreeRelay_query">;
};
export type knowledgeBaseBodySubtreeRelayQuery = {
  response: knowledgeBaseBodySubtreeRelayQuery$data;
  variables: knowledgeBaseBodySubtreeRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v4 = [
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
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "knowledgeBaseBodySubtreeRelayQuery",
    "selections": [
      {
        "args": (v4/*: any*/),
        "kind": "FragmentSpread",
        "name": "knowledgeBaseBodySubtreeRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "knowledgeBaseBodySubtreeRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
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
                  (v5/*: any*/),
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
                      (v5/*: any*/),
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
        "args": (v4/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "knowledgeBaseBodyArticlesSubtree__knowledgeBaseItems",
        "kind": "LinkedHandle",
        "name": "knowledgeBaseItems"
      }
    ]
  },
  "params": {
    "cacheID": "7094938262aaa126fd071b3d9b4c84d5",
    "id": null,
    "metadata": {},
    "name": "knowledgeBaseBodySubtreeRelayQuery",
    "operationKind": "query",
    "text": "query knowledgeBaseBodySubtreeRelayQuery(\n  $filter: KnowledgeBaseFilterInput\n  $search: String\n  $first: Int!\n  $after: String\n) {\n  ...knowledgeBaseBodySubtreeRelay_query_2zR4qx\n}\n\nfragment knowledgeBaseBodySubtreeRelay_query_2zR4qx on Query {\n  knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        ...knowledgeBaseTableRow_node\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    filteredCount\n  }\n}\n\nfragment knowledgeBaseTableRow_node on KnowledgeBaseItem {\n  id\n  type\n  name\n  parentId\n  status\n  summary\n  createdAt\n  updatedAt\n  tags {\n    id\n    key\n    color\n  }\n}\n"
  }
};
})();

(node as any).hash = "3dc4f5f73f31be11034e65615dcad790";

export default node;
