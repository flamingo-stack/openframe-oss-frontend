/**
 * @generated SignedSource<<030cae263e780b08c08cbb2a5b758d64>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type LogSortField = "TIMESTAMP" | "%future added value";
export type SortDirection = "ASC" | "DESC" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { LocalDate } from "../lib/graphql-scalars";
export type LogFilterInput = {
  deviceId?: string | null | undefined;
  endDate?: LocalDate | null | undefined;
  eventTypes?: ReadonlyArray<string> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  severities?: ReadonlyArray<string> | null | undefined;
  startDate?: LocalDate | null | undefined;
  timestampFrom?: Instant | null | undefined;
  timestampTo?: Instant | null | undefined;
  toolTypes?: ReadonlyArray<string> | null | undefined;
};
export type LogSortInput = {
  direction: SortDirection;
  field: LogSortField;
};
export type logsTableRelayPaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: LogFilterInput | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
  sort?: LogSortInput | null | undefined;
};
export type logsTableRelayPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"logsTableRelay_query">;
};
export type logsTableRelayPaginationQuery = {
  response: logsTableRelayPaginationQuery$data;
  variables: logsTableRelayPaginationQuery$variables;
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
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sort"
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
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "logsTableRelayPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "logsTableRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "logsTableRelayPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "LogConnection",
        "kind": "LinkedField",
        "name": "logs",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LogEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "LogEvent",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "toolEventId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "eventType",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "ingestDay",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "toolType",
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
                    "kind": "ScalarField",
                    "name": "deviceId",
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
                    "name": "nickname",
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
                    "kind": "ScalarField",
                    "name": "organizationName",
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
                    "name": "timestamp",
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
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "filter",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "logsTableRelay_logs",
        "kind": "LinkedHandle",
        "name": "logs"
      }
    ]
  },
  "params": {
    "cacheID": "163d16a87db4e825a1e1b0b0feee721f",
    "id": null,
    "metadata": {},
    "name": "logsTableRelayPaginationQuery",
    "operationKind": "query",
    "text": "query logsTableRelayPaginationQuery(\n  $after: String\n  $filter: LogFilterInput\n  $first: Int = 20\n  $search: String\n  $sort: LogSortInput\n) {\n  ...logsTableRelay_query_3PAeYV\n}\n\nfragment logCopyButton_log on LogEvent {\n  toolEventId\n  ingestDay\n  toolType\n  eventType\n  timestamp\n}\n\nfragment logDrawerDetails_log on LogEvent {\n  toolEventId\n  ingestDay\n  toolType\n  eventType\n  timestamp\n}\n\nfragment logsTableRelay_query_3PAeYV on Query {\n  logs(filter: $filter, first: $first, after: $after, search: $search, sort: $sort) {\n    edges {\n      node {\n        id\n        toolEventId\n        eventType\n        ingestDay\n        toolType\n        severity\n        deviceId\n        hostname\n        nickname\n        organizationId\n        organizationName\n        summary\n        timestamp\n        ...logCopyButton_log\n        ...logDrawerDetails_log\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "765992a7f2d29ef3b5cf94df4728ea7d";

export default node;
