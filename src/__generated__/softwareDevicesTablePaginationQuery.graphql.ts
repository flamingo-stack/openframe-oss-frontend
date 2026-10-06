/**
 * @generated SignedSource<<72c5055ea89ee569bd900c50643688b6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type SoftwareOnDeviceStatus = "OUTDATED" | "SCHEDULED_UNINSTALL" | "SCHEDULED_UPDATE" | "UNINSTALLING" | "UP_TO_DATE" | "%future added value";
export type SortDirection = "ASC" | "DESC" | "%future added value";
export type SoftwareOnDeviceFilterInput = {
  deviceTagIds?: ReadonlyArray<string> | null | undefined;
  statuses?: ReadonlyArray<SoftwareOnDeviceStatus> | null | undefined;
};
export type SortInput = {
  direction?: SortDirection | null | undefined;
  field?: string | null | undefined;
};
export type softwareDevicesTablePaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: SoftwareOnDeviceFilterInput | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
  softwareId: string;
  sort?: SortInput | null | undefined;
};
export type softwareDevicesTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareDevicesTable_query">;
};
export type softwareDevicesTablePaginationQuery = {
  response: softwareDevicesTablePaginationQuery$data;
  variables: softwareDevicesTablePaginationQuery$variables;
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
    "name": "softwareId"
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
    "name": "softwareId",
    "variableName": "softwareId"
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v3 = {
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
    "name": "softwareDevicesTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareDevicesTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "softwareDevicesTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareOnDeviceConnection",
        "kind": "LinkedField",
        "name": "softwareDevices",
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
            "concreteType": "SoftwareOnDeviceEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SoftwareOnDevice",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Machine",
                    "kind": "LinkedField",
                    "name": "device",
                    "plural": false,
                    "selections": [
                      (v3/*: any*/),
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
                        "kind": "ScalarField",
                        "name": "nickname",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "displayName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hostname",
                        "storageKey": null
                      },
                      (v2/*: any*/),
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
                        "concreteType": "Organization",
                        "kind": "LinkedField",
                        "name": "organization",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "name",
                            "storageKey": null
                          },
                          (v3/*: any*/)
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
                    "name": "softwareVersion",
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
          "softwareId",
          "filter",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "softwareDevicesTable_softwareDevices",
        "kind": "LinkedHandle",
        "name": "softwareDevices"
      }
    ]
  },
  "params": {
    "cacheID": "ee4ddc90f2785387c9cd897a5169cd7b",
    "id": null,
    "metadata": {},
    "name": "softwareDevicesTablePaginationQuery",
    "operationKind": "query",
    "text": "query softwareDevicesTablePaginationQuery(\n  $after: String\n  $filter: SoftwareOnDeviceFilterInput\n  $first: Int = 20\n  $search: String\n  $softwareId: ID!\n  $sort: SortInput\n) {\n  ...softwareDevicesTable_query_E6AuK\n}\n\nfragment softwareDeviceCell_machine on Machine {\n  nickname\n  displayName\n  hostname\n  status\n  type\n  organization {\n    name\n    id\n  }\n}\n\nfragment softwareDeviceVersionCell_softwareOnDevice on SoftwareOnDevice {\n  softwareVersion\n  status\n}\n\nfragment softwareDevicesTable_query_E6AuK on Query {\n  softwareDevices(softwareId: $softwareId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        status\n        device {\n          id\n          machineId\n          ...softwareDeviceCell_machine\n        }\n        ...softwareDeviceVersionCell_softwareOnDevice\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "70364f2f3f183ed8862b544d78f10983";

export default node;
