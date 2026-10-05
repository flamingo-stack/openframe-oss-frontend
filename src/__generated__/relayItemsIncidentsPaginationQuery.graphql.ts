/**
 * @generated SignedSource<<aa73437515ce5a30cd6bf823ea3dfe0e>>
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
export type relayItemsIncidentsPaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: InsightFilter | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsIncidentsPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsIncidents_query">;
};
export type relayItemsIncidentsPaginationQuery = {
  response: relayItemsIncidentsPaginationQuery$data;
  variables: relayItemsIncidentsPaginationQuery$variables;
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
    "defaultValue": 10,
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
    "name": "relayItemsIncidentsPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "relayItemsIncidents_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "relayItemsIncidentsPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
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
                      (v2/*: any*/)
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
        "args": (v1/*: any*/),
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
    "cacheID": "7f749ca286a18a2fcbed2c75417a607f",
    "id": null,
    "metadata": {},
    "name": "relayItemsIncidentsPaginationQuery",
    "operationKind": "query",
    "text": "query relayItemsIncidentsPaginationQuery(\n  $after: String\n  $filter: InsightFilter\n  $first: Int = 10\n  $search: String\n) {\n  ...relayItemsIncidents_query_2zR4qx\n}\n\nfragment relayItemsIncidents_query_2zR4qx on Query {\n  insights(filter: $filter, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        severity\n        machine {\n          nickname\n          hostname\n          displayName\n          id\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5f1fb4ff3a09bfbc5620f029a7ba05f1";

export default node;
