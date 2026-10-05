/**
 * @generated SignedSource<<b9a7f8fdc74b1cad4ecb01a62cdc1342>>
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
export type deviceLogsListQuery$variables = {
  after?: string | null | undefined;
  filter?: DeviceLogFilterInput | null | undefined;
  first: number;
  machineId: string;
};
export type deviceLogsListQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"deviceLogsList_query">;
};
export type deviceLogsListQuery = {
  response: deviceLogsListQuery$data;
  variables: deviceLogsListQuery$variables;
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
  "name": "machineId"
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
    "name": "machineId",
    "variableName": "machineId"
  }
];
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
    "name": "deviceLogsListQuery",
    "selections": [
      {
        "args": (v4/*: any*/),
        "kind": "FragmentSpread",
        "name": "deviceLogsList_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "deviceLogsListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
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
        "args": (v4/*: any*/),
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
    "cacheID": "9329a78a6f23c571e946b085cb428534",
    "id": null,
    "metadata": {},
    "name": "deviceLogsListQuery",
    "operationKind": "query",
    "text": "query deviceLogsListQuery(\n  $machineId: String!\n  $filter: DeviceLogFilterInput\n  $first: Int!\n  $after: String\n) {\n  ...deviceLogsList_query_2ZqsDP\n}\n\nfragment deviceLogRow_entry on DeviceLogEntry {\n  timestamp\n  agentTimestamp\n  level\n  message\n  hostname\n  count\n}\n\nfragment deviceLogsList_query_2ZqsDP on Query {\n  deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after) {\n    edges {\n      cursor\n      node {\n        timestamp\n        ...deviceLogRow_entry\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1107559494bf4cd498e1674dda8cfd64";

export default node;
