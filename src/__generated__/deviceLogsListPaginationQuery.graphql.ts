/**
 * @generated SignedSource<<615f3afa3ea6c1f258655bc876fe8131>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DeviceLogLevel = "DEBUG" | "ERROR" | "INFO" | "WARN" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type DeviceLogFilterInput = {
  contains?: ReadonlyArray<string> | null | undefined;
  excludes?: ReadonlyArray<string> | null | undefined;
  from?: Instant | null | undefined;
  levels?: ReadonlyArray<DeviceLogLevel> | null | undefined;
  to?: Instant | null | undefined;
};
export type deviceLogsListPaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: DeviceLogFilterInput | null | undefined;
  first: number;
  machineId: string;
};
export type deviceLogsListPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"deviceLogsList_query">;
};
export type deviceLogsListPaginationQuery = {
  response: deviceLogsListPaginationQuery$data;
  variables: deviceLogsListPaginationQuery$variables;
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
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "machineId"
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
    "name": "machineId",
    "variableName": "machineId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "deviceLogsListPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "deviceLogsList_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deviceLogsListPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeviceLogConnection",
        "kind": "LinkedField",
        "name": "deviceLogs",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DeviceLogEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "DeviceLogEntry",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "timestamp",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "agentTimestamp",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "level",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "message",
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
                    "name": "count",
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
          "machineId",
          "filter"
        ],
        "handle": "connection",
        "key": "deviceLogsList_deviceLogs",
        "kind": "LinkedHandle",
        "name": "deviceLogs"
      }
    ]
  },
  "params": {
    "cacheID": "85c4a0c6090e50a5c22fd2033f834d7b",
    "id": null,
    "metadata": {},
    "name": "deviceLogsListPaginationQuery",
    "operationKind": "query",
    "text": "query deviceLogsListPaginationQuery(\n  $after: String\n  $filter: DeviceLogFilterInput\n  $first: Int!\n  $machineId: String!\n) {\n  ...deviceLogsList_query_2ZqsDP\n}\n\nfragment deviceLogRow_entry on DeviceLogEntry {\n  timestamp\n  agentTimestamp\n  level\n  message\n  hostname\n  count\n}\n\nfragment deviceLogsList_query_2ZqsDP on Query {\n  deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after) {\n    edges {\n      cursor\n      node {\n        timestamp\n        ...deviceLogRow_entry\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "38b978cd8d6840016a03d29c2286c159";

export default node;
