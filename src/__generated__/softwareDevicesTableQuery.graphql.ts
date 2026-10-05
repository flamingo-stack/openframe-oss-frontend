/**
 * @generated SignedSource<<ef52adaaba319f22d68df57b887fb485>>
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
export type softwareDevicesTableQuery$variables = {
  after?: string | null | undefined;
  filter?: SoftwareOnDeviceFilterInput | null | undefined;
  first: number;
  search?: string | null | undefined;
  softwareId: string;
  sort?: SortInput | null | undefined;
};
export type softwareDevicesTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareDevicesTable_query">;
};
export type softwareDevicesTableQuery = {
  response: softwareDevicesTableQuery$data;
  variables: softwareDevicesTableQuery$variables;
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
  "name": "softwareId"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sort"
},
v6 = [
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
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
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
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareDevicesTableQuery",
    "selections": [
      {
        "args": (v6/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareDevicesTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v4/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/),
      (v5/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "softwareDevicesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
                  (v7/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Machine",
                    "kind": "LinkedField",
                    "name": "device",
                    "plural": false,
                    "selections": [
                      (v8/*: any*/),
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
                      (v7/*: any*/),
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
                          (v8/*: any*/)
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
        "args": (v6/*: any*/),
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
    "cacheID": "aebbcd154ef2a4af1d106d2c2ddba78c",
    "id": null,
    "metadata": {},
    "name": "softwareDevicesTableQuery",
    "operationKind": "query",
    "text": "query softwareDevicesTableQuery(\n  $softwareId: ID!\n  $filter: SoftwareOnDeviceFilterInput\n  $search: String\n  $sort: SortInput\n  $first: Int!\n  $after: String\n) {\n  ...softwareDevicesTable_query_E6AuK\n}\n\nfragment softwareDeviceCell_machine on Machine {\n  nickname\n  displayName\n  hostname\n  status\n  type\n  organization {\n    name\n    id\n  }\n}\n\nfragment softwareDeviceVersionCell_softwareOnDevice on SoftwareOnDevice {\n  softwareVersion\n  status\n}\n\nfragment softwareDevicesTable_query_E6AuK on Query {\n  softwareDevices(softwareId: $softwareId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        status\n        device {\n          id\n          machineId\n          ...softwareDeviceCell_machine\n        }\n        ...softwareDeviceVersionCell_softwareOnDevice\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a02d8dedcac85d3f489b0d14a76e4a0d";

export default node;
