/**
 * @generated SignedSource<<3dcd2642727fed9b2a5b161b79fbd3be>>
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
export type relayItemsIncidentsListQuery$variables = {
  filter?: InsightFilter | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsIncidentsListQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsIncidents_query">;
};
export type relayItemsIncidentsListQuery = {
  response: relayItemsIncidentsListQuery$data;
  variables: relayItemsIncidentsListQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
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
v3 = [
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
v4 = {
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
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "relayItemsIncidentsListQuery",
    "selections": [
      {
        "args": (v3/*: any*/),
        "kind": "FragmentSpread",
        "name": "relayItemsIncidents_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "relayItemsIncidentsListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
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
                  (v4/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "title",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "severity",
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
                      (v4/*: any*/)
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
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
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
        "args": (v3/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "relayItemsIncidents_insights",
        "kind": "LinkedHandle",
        "name": "insights"
      }
    ]
  },
  "params": {
    "cacheID": "2d3b5af3de10a790320f5076b0652d24",
    "id": null,
    "metadata": {},
    "name": "relayItemsIncidentsListQuery",
    "operationKind": "query",
    "text": "query relayItemsIncidentsListQuery(\n  $filter: InsightFilter\n  $search: String\n  $first: Int\n) {\n  ...relayItemsIncidents_query_Dmzkx\n}\n\nfragment relayItemsIncidents_query_Dmzkx on Query {\n  insights(filter: $filter, search: $search, first: $first) {\n    edges {\n      node {\n        id\n        title\n        severity\n        machine {\n          nickname\n          hostname\n          displayName\n          id\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "87e752b93128d3e8c24d3b6bd2f64b32";

export default node;
