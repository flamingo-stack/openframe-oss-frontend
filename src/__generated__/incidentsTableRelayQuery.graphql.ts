/**
 * @generated SignedSource<<baf158f403e9be78b1cffcd3c7a09bac>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type InsightSeverity = "CRITICAL" | "HIGH" | "INFO" | "LOW" | "MEDIUM" | "%future added value";
export type InsightStatus = "ACKNOWLEDGED" | "ARCHIVED" | "NEW" | "RESOLVED" | "SNOOZED" | "%future added value";
export type InsightType = "IT" | "SECURITY" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type InsightFilter = {
  assigneeIds?: ReadonlyArray<string> | null | undefined;
  detectedAtFrom?: Instant | null | undefined;
  detectedAtTo?: Instant | null | undefined;
  machineIds?: ReadonlyArray<string> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  severities?: ReadonlyArray<InsightSeverity> | null | undefined;
  statuses?: ReadonlyArray<InsightStatus> | null | undefined;
  types?: ReadonlyArray<InsightType> | null | undefined;
};
export type incidentsTableRelayQuery$variables = {
  after?: string | null | undefined;
  filter?: InsightFilter | null | undefined;
  first: number;
  search?: string | null | undefined;
};
export type incidentsTableRelayQuery$data = {
  readonly insightFilters: {
    readonly " $fragmentSpreads": FragmentRefs<"insightFacets_filters">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"incidentsTableRelay_query" | "insightTransitions_query">;
};
export type incidentsTableRelayQuery = {
  response: incidentsTableRelayQuery$data;
  variables: incidentsTableRelayQuery$variables;
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
v5 = {
  "kind": "Variable",
  "name": "search",
  "variableName": "search"
},
v6 = [
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
  (v5/*: any*/)
],
v7 = [
  (v4/*: any*/),
  (v5/*: any*/)
],
v8 = [
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
v9 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "InsightFilterOption",
    "kind": "LinkedField",
    "name": "types",
    "plural": true,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "InsightFilterOption",
    "kind": "LinkedField",
    "name": "severities",
    "plural": true,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "InsightFilterOption",
    "kind": "LinkedField",
    "name": "statuses",
    "plural": true,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "InsightFilterOption",
    "kind": "LinkedField",
    "name": "organizationIds",
    "plural": true,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "InsightFilterOption",
    "kind": "LinkedField",
    "name": "assigneeIds",
    "plural": true,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "filteredCount",
    "storageKey": null
  }
],
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "InsightStatusTransition",
  "kind": "LinkedField",
  "name": "insightStatusTransitions",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "from",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "to",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
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
    "name": "incidentsTableRelayQuery",
    "selections": [
      {
        "args": (v6/*: any*/),
        "kind": "FragmentSpread",
        "name": "incidentsTableRelay_query"
      },
      {
        "alias": null,
        "args": (v7/*: any*/),
        "concreteType": "InsightFilters",
        "kind": "LinkedField",
        "name": "insightFilters",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "insightFacets_filters",
            "selections": (v9/*: any*/),
            "args": null,
            "argumentDefinitions": []
          }
        ],
        "storageKey": null
      },
      {
        "kind": "InlineDataFragmentSpread",
        "name": "insightTransitions_query",
        "selections": [
          (v10/*: any*/)
        ],
        "args": null,
        "argumentDefinitions": []
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
    "name": "incidentsTableRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
        "concreteType": "InsightConnection",
        "kind": "LinkedField",
        "name": "insights",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "InsightEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Insight",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "title",
                    "storageKey": null
                  },
                  (v12/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "severity",
                    "storageKey": null
                  },
                  (v13/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "snoozedUntil",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "detectedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "machineId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Machine",
                    "kind": "LinkedField",
                    "name": "machine",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "nickname",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hostname",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "displayName",
                        "storageKey": null
                      },
                      (v12/*: any*/),
                      (v11/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "organizationId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Organization",
                    "kind": "LinkedField",
                    "name": "organization",
                    "plural": false,
                    "selections": [
                      (v11/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "name",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "assigneeId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "assignee",
                    "plural": false,
                    "selections": [
                      (v11/*: any*/),
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
                      (v13/*: any*/),
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
        "args": (v6/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "incidentsTableRelay_insights",
        "kind": "LinkedHandle",
        "name": "insights"
      },
      {
        "alias": null,
        "args": (v7/*: any*/),
        "concreteType": "InsightFilters",
        "kind": "LinkedField",
        "name": "insightFilters",
        "plural": false,
        "selections": (v9/*: any*/),
        "storageKey": null
      },
      (v10/*: any*/)
    ]
  },
  "params": {
    "cacheID": "3c3291ae3afa49beb881282c59884b9d",
    "id": null,
    "metadata": {},
    "name": "incidentsTableRelayQuery",
    "operationKind": "query",
    "text": "query incidentsTableRelayQuery(\n  $filter: InsightFilter\n  $search: String\n  $first: Int!\n  $after: String\n) {\n  ...incidentsTableRelay_query_2zR4qx\n  insightFilters(filter: $filter, search: $search) {\n    ...insightFacets_filters\n  }\n  ...insightTransitions_query\n}\n\nfragment incidentsTableRelay_query_2zR4qx on Query {\n  insights(filter: $filter, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        ...insightRowFields_insight\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment insightFacets_filters on InsightFilters {\n  types {\n    value\n    label\n    count\n  }\n  severities {\n    value\n    label\n    count\n  }\n  statuses {\n    value\n    label\n    count\n  }\n  organizationIds {\n    value\n    label\n    count\n  }\n  assigneeIds {\n    value\n    label\n    count\n  }\n  filteredCount\n}\n\nfragment insightRowFields_insight on Insight {\n  id\n  title\n  type\n  severity\n  status\n  snoozedUntil\n  detectedAt\n  machineId\n  machine {\n    nickname\n    hostname\n    displayName\n    type\n    id\n  }\n  organizationId\n  organization {\n    id\n    name\n  }\n  assigneeId\n  assignee {\n    ...insightUserFields_user\n    id\n  }\n}\n\nfragment insightTransitions_query on Query {\n  insightStatusTransitions {\n    from\n    to\n  }\n}\n\nfragment insightUserFields_user on User {\n  id\n  firstName\n  lastName\n  email\n  status\n  image {\n    imageUrl\n    hash\n  }\n}\n"
  }
};
})();

(node as any).hash = "924841dbb87d64fa214477558a88e4ff";

export default node;
