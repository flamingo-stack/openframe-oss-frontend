/**
 * @generated SignedSource<<a0a4e20bfbdae9bb75f349391c4e0f61>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type DeviceFilterInput = {
  deviceTypes?: ReadonlyArray<DeviceType> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  osTypes?: ReadonlyArray<string> | null | undefined;
  statuses?: ReadonlyArray<DeviceStatus> | null | undefined;
  tagKeys?: ReadonlyArray<string> | null | undefined;
  tagValues?: ReadonlyArray<string> | null | undefined;
};
export type scheduleDeviceFiltersRelayQuery$variables = {
  assigned: boolean;
  available: boolean;
  filter?: DeviceFilterInput | null | undefined;
  scheduleId: string;
  search?: string | null | undefined;
};
export type scheduleDeviceFiltersRelayQuery$data = {
  readonly scriptSchedule: {
    readonly assignedDeviceFilters?: {
      readonly " $fragmentSpreads": FragmentRefs<"deviceFacetsFields_filters">;
    };
    readonly availableDeviceFilters?: {
      readonly " $fragmentSpreads": FragmentRefs<"deviceFacetsFields_filters">;
    };
    readonly id: string;
  };
};
export type scheduleDeviceFiltersRelayQuery = {
  response: scheduleDeviceFiltersRelayQuery$data;
  variables: scheduleDeviceFiltersRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "assigned"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "available"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scheduleId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "scheduleId"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Variable",
    "name": "search",
    "variableName": "search"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v10 = [
  (v8/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "label",
    "storageKey": null
  },
  (v9/*: any*/)
],
v11 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "statuses",
    "plural": true,
    "selections": (v10/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "deviceTypes",
    "plural": true,
    "selections": (v10/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "osTypes",
    "plural": true,
    "selections": (v10/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "organizationIds",
    "plural": true,
    "selections": (v10/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "TagFilterOption",
    "kind": "LinkedField",
    "name": "tagKeys",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "key",
        "storageKey": null
      },
      (v8/*: any*/),
      (v9/*: any*/)
    ],
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
v12 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "deviceFacetsFields_filters",
    "selections": (v11/*: any*/),
    "args": null,
    "argumentDefinitions": ([]/*: any*/)
  }
];
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
    "name": "scheduleDeviceFiltersRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "scriptSchedule",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          {
            "condition": "available",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": "DeviceFilters",
                "kind": "LinkedField",
                "name": "availableDeviceFilters",
                "plural": false,
                "selections": (v12/*: any*/),
                "storageKey": null
              }
            ]
          },
          {
            "condition": "assigned",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": "DeviceFilters",
                "kind": "LinkedField",
                "name": "assignedDeviceFilters",
                "plural": false,
                "selections": (v12/*: any*/),
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "scheduleDeviceFiltersRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "scriptSchedule",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          {
            "condition": "available",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": "DeviceFilters",
                "kind": "LinkedField",
                "name": "availableDeviceFilters",
                "plural": false,
                "selections": (v11/*: any*/),
                "storageKey": null
              }
            ]
          },
          {
            "condition": "assigned",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": "DeviceFilters",
                "kind": "LinkedField",
                "name": "assignedDeviceFilters",
                "plural": false,
                "selections": (v11/*: any*/),
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9cfb76b0eca539b04c1a60ba1a34aaae",
    "id": null,
    "metadata": {},
    "name": "scheduleDeviceFiltersRelayQuery",
    "operationKind": "query",
    "text": "query scheduleDeviceFiltersRelayQuery(\n  $scheduleId: ID!\n  $filter: DeviceFilterInput\n  $search: String\n  $available: Boolean!\n  $assigned: Boolean!\n) {\n  scriptSchedule(id: $scheduleId) {\n    id\n    availableDeviceFilters(filter: $filter, search: $search) @include(if: $available) {\n      ...deviceFacetsFields_filters\n    }\n    assignedDeviceFilters(filter: $filter, search: $search) @include(if: $assigned) {\n      ...deviceFacetsFields_filters\n    }\n  }\n}\n\nfragment deviceFacetsFields_filters on DeviceFilters {\n  statuses {\n    value\n    label\n    count\n  }\n  deviceTypes {\n    value\n    label\n    count\n  }\n  osTypes {\n    value\n    label\n    count\n  }\n  organizationIds {\n    value\n    label\n    count\n  }\n  tagKeys {\n    key\n    value\n    count\n  }\n  filteredCount\n}\n"
  }
};
})();

(node as any).hash = "38d932ab3eace9ba4364e1e5178b8ee0";

export default node;
