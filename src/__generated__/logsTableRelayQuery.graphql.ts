/**
 * @generated SignedSource<<0dbbe0e6fe76d5c0b37772bc58ca63b1>>
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
export type logsTableRelayQuery$variables = {
  after?: string | null | undefined;
  filter?: LogFilterInput | null | undefined;
  first: number;
  search?: string | null | undefined;
  sort?: LogSortInput | null | undefined;
};
export type logsTableRelayQuery$data = {
  readonly logFilters: {
    readonly eventTypes: ReadonlyArray<string>;
    readonly organizations: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
    readonly severities: ReadonlyArray<string>;
    readonly toolTypes: ReadonlyArray<string>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"logsTableRelay_query">;
};
export type logsTableRelayQuery = {
  response: logsTableRelayQuery$data;
  variables: logsTableRelayQuery$variables;
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
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sort"
},
v5 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v6 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  (v5/*: any*/),
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
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": [
    (v5/*: any*/)
  ],
  "concreteType": "LogFilters",
  "kind": "LinkedField",
  "name": "logFilters",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "toolTypes",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "eventTypes",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "severities",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "OrganizationFilterOption",
      "kind": "LinkedField",
      "name": "organizations",
      "plural": true,
      "selections": [
        (v7/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "logsTableRelayQuery",
    "selections": [
      {
        "args": (v6/*: any*/),
        "kind": "FragmentSpread",
        "name": "logsTableRelay_query"
      },
      (v8/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Operation",
    "name": "logsTableRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
                  (v7/*: any*/),
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
        "args": (v6/*: any*/),
        "filters": [
          "filter",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "logsTableRelay_logs",
        "kind": "LinkedHandle",
        "name": "logs"
      },
      (v8/*: any*/)
    ]
  },
  "params": {
    "cacheID": "12dee95e92aa1181fa682dfb2b90afc5",
    "id": null,
    "metadata": {},
    "name": "logsTableRelayQuery",
    "operationKind": "query",
    "text": "query logsTableRelayQuery(\n  $filter: LogFilterInput\n  $first: Int!\n  $after: String\n  $search: String\n  $sort: LogSortInput\n) {\n  ...logsTableRelay_query_3PAeYV\n  logFilters(filter: $filter) {\n    toolTypes\n    eventTypes\n    severities\n    organizations {\n      id\n      name\n    }\n  }\n}\n\nfragment logCopyButton_log on LogEvent {\n  toolEventId\n  ingestDay\n  toolType\n  eventType\n  timestamp\n}\n\nfragment logDrawerDetails_log on LogEvent {\n  toolEventId\n  ingestDay\n  toolType\n  eventType\n  timestamp\n}\n\nfragment logsTableRelay_query_3PAeYV on Query {\n  logs(filter: $filter, first: $first, after: $after, search: $search, sort: $sort) {\n    edges {\n      node {\n        id\n        toolEventId\n        eventType\n        ingestDay\n        toolType\n        severity\n        deviceId\n        hostname\n        nickname\n        organizationId\n        organizationName\n        summary\n        timestamp\n        ...logCopyButton_log\n        ...logDrawerDetails_log\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8850eecddf12913eda6830b0cfa3c8e8";

export default node;
