/**
 * @generated SignedSource<<48abebd230519d28e90b7ad9711efe5f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type knowledgeBaseTableArchivedRelayQuery$variables = {
  after?: string | null | undefined;
  first: number;
  search?: string | null | undefined;
  tagIds?: ReadonlyArray<string | null | undefined> | null | undefined;
};
export type knowledgeBaseTableArchivedRelayQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"knowledgeBaseTableArchivedRelay_query">;
};
export type knowledgeBaseTableArchivedRelayQuery = {
  response: knowledgeBaseTableArchivedRelayQuery$data;
  variables: knowledgeBaseTableArchivedRelayQuery$variables;
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
  "name": "first"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tagIds"
},
v4 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
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
  },
  {
    "kind": "Variable",
    "name": "tagIds",
    "variableName": "tagIds"
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
    "name": "knowledgeBaseTableArchivedRelayQuery",
    "selections": [
      {
        "args": (v4/*: any*/),
        "kind": "FragmentSpread",
        "name": "knowledgeBaseTableArchivedRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "knowledgeBaseTableArchivedRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": "KnowledgeBaseItemConnection",
        "kind": "LinkedField",
        "name": "archivedArticles",
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
          "search",
          "tagIds"
        ],
        "handle": "connection",
        "key": "knowledgeBaseTable_archivedArticles",
        "kind": "LinkedHandle",
        "name": "archivedArticles"
      }
    ]
  },
  "params": {
    "cacheID": "ed21d86c8f793cb230654730267187cf",
    "id": null,
    "metadata": {},
    "name": "knowledgeBaseTableArchivedRelayQuery",
    "operationKind": "query",
    "text": "query knowledgeBaseTableArchivedRelayQuery(\n  $search: String\n  $tagIds: [ID]\n  $first: Int!\n  $after: String\n) {\n  ...knowledgeBaseTableArchivedRelay_query_3za0JU\n}\n\nfragment knowledgeBaseTableArchivedRelay_query_3za0JU on Query {\n  archivedArticles(search: $search, tagIds: $tagIds, first: $first, after: $after) {\n    edges {\n      node {\n        ...knowledgeBaseTableRow_node\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    filteredCount\n  }\n}\n\nfragment knowledgeBaseTableRow_node on KnowledgeBaseItem {\n  id\n  type\n  name\n  parentId\n  status\n  summary\n  createdAt\n  updatedAt\n  tags {\n    id\n    key\n    color\n  }\n}\n"
  }
};
})();

(node as any).hash = "915cc23805a73b42a16e0707defba2a5";

export default node;
