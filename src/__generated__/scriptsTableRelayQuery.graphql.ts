/**
 * @generated SignedSource<<d01dd270e6874730d691b7ad10f6526f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type ScriptShell = "BASH" | "CMD" | "NUSHELL" | "POWERSHELL" | "PYTHON" | "SHELL" | "%future added value";
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type ScriptFilterInput = {
  authorIds?: ReadonlyArray<string> | null | undefined;
  shells?: ReadonlyArray<ScriptShell> | null | undefined;
  statuses?: ReadonlyArray<ScriptStatus> | null | undefined;
  supportedPlatforms?: ReadonlyArray<OsType> | null | undefined;
  tagIds?: ReadonlyArray<string> | null | undefined;
};
export type scriptsTableRelayQuery$variables = {
  after?: string | null | undefined;
  filter?: ScriptFilterInput | null | undefined;
  first: number;
  search?: string | null | undefined;
};
export type scriptsTableRelayQuery$data = {
  readonly scriptFilters: {
    readonly authors: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly platforms: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly shells: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"scriptsTableRelay_query">;
};
export type scriptsTableRelayQuery = {
  response: scriptsTableRelayQuery$data;
  variables: scriptsTableRelayQuery$variables;
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
v4 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v5 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  (v4/*: any*/),
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
v6 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "label",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "count",
    "storageKey": null
  }
],
v7 = {
  "alias": null,
  "args": [
    (v4/*: any*/)
  ],
  "concreteType": "ScriptFilters",
  "kind": "LinkedField",
  "name": "scriptFilters",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ScriptFilterOption",
      "kind": "LinkedField",
      "name": "shells",
      "plural": true,
      "selections": (v6/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ScriptFilterOption",
      "kind": "LinkedField",
      "name": "platforms",
      "plural": true,
      "selections": (v6/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ScriptFilterOption",
      "kind": "LinkedField",
      "name": "authors",
      "plural": true,
      "selections": (v6/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
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
    "name": "scriptsTableRelayQuery",
    "selections": [
      {
        "args": (v5/*: any*/),
        "kind": "FragmentSpread",
        "name": "scriptsTableRelay_query"
      },
      (v7/*: any*/)
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
    "name": "scriptsTableRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
        "concreteType": "ScriptConnection",
        "kind": "LinkedField",
        "name": "scripts",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "filteredCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ScriptEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Script",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v8/*: any*/),
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
                    "name": "description",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "shell",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "supportedPlatforms",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "defaultTimeoutSeconds",
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
                      (v8/*: any*/),
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
                        "kind": "ScalarField",
                        "name": "status",
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
        "args": (v5/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "scriptsTableRelay_scripts",
        "kind": "LinkedHandle",
        "name": "scripts"
      },
      (v7/*: any*/)
    ]
  },
  "params": {
    "cacheID": "14df44fe191ed8a1f008016dce4b2e1a",
    "id": null,
    "metadata": {},
    "name": "scriptsTableRelayQuery",
    "operationKind": "query",
    "text": "query scriptsTableRelayQuery(\n  $filter: ScriptFilterInput\n  $search: String\n  $first: Int!\n  $after: String\n) {\n  ...scriptsTableRelay_query_2zR4qx\n  scriptFilters(filter: $filter) {\n    shells {\n      value\n      label\n      count\n    }\n    platforms {\n      value\n      label\n      count\n    }\n    authors {\n      value\n      label\n      count\n    }\n  }\n}\n\nfragment scriptsTableRelay_query_2zR4qx on Query {\n  scripts(filter: $filter, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        id\n        name\n        description\n        shell\n        supportedPlatforms\n        defaultTimeoutSeconds\n        author {\n          id\n          firstName\n          lastName\n          email\n          status\n          image {\n            imageUrl\n            hash\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c013b805218b7125a77dbfa3ba6f1f65";

export default node;
