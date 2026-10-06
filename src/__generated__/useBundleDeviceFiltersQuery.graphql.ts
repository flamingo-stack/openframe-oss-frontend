/**
 * @generated SignedSource<<2d5e956f65fe9c5a1f371cd59a701204>>
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
export type useBundleDeviceFiltersQuery$variables = {
  bundleId: string;
  filter?: DeviceFilterInput | null | undefined;
};
export type useBundleDeviceFiltersQuery$data = {
  readonly softwareBundle: {
    readonly assignedDeviceFilters: {
      readonly " $fragmentSpreads": FragmentRefs<"deviceFacetsFields_filters">;
    };
    readonly availableDeviceFilters: {
      readonly " $fragmentSpreads": FragmentRefs<"deviceFacetsFields_filters">;
    };
    readonly id: string;
  } | null | undefined;
};
export type useBundleDeviceFiltersQuery = {
  response: useBundleDeviceFiltersQuery$data;
  variables: useBundleDeviceFiltersQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "bundleId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "bundleId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v6 = [
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "label",
    "storageKey": null
  },
  (v5/*: any*/)
],
v7 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "statuses",
    "plural": true,
    "selections": (v6/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "deviceTypes",
    "plural": true,
    "selections": (v6/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "osTypes",
    "plural": true,
    "selections": (v6/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DeviceFilterOption",
    "kind": "LinkedField",
    "name": "organizationIds",
    "plural": true,
    "selections": (v6/*: any*/),
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
      (v4/*: any*/),
      (v5/*: any*/)
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
v8 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "deviceFacetsFields_filters",
    "selections": (v7/*: any*/),
    "args": null,
    "argumentDefinitions": ([]/*: any*/)
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useBundleDeviceFiltersQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareBundle",
        "kind": "LinkedField",
        "name": "softwareBundle",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "DeviceFilters",
            "kind": "LinkedField",
            "name": "availableDeviceFilters",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "DeviceFilters",
            "kind": "LinkedField",
            "name": "assignedDeviceFilters",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": null
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useBundleDeviceFiltersQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareBundle",
        "kind": "LinkedField",
        "name": "softwareBundle",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "DeviceFilters",
            "kind": "LinkedField",
            "name": "availableDeviceFilters",
            "plural": false,
            "selections": (v7/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "DeviceFilters",
            "kind": "LinkedField",
            "name": "assignedDeviceFilters",
            "plural": false,
            "selections": (v7/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7b213d2f676a0a06a151441c43d17171",
    "id": null,
    "metadata": {},
    "name": "useBundleDeviceFiltersQuery",
    "operationKind": "query",
    "text": "query useBundleDeviceFiltersQuery(\n  $bundleId: ID!\n  $filter: DeviceFilterInput\n) {\n  softwareBundle(id: $bundleId) {\n    id\n    availableDeviceFilters(filter: $filter) {\n      ...deviceFacetsFields_filters\n    }\n    assignedDeviceFilters(filter: $filter) {\n      ...deviceFacetsFields_filters\n    }\n  }\n}\n\nfragment deviceFacetsFields_filters on DeviceFilters {\n  statuses {\n    value\n    label\n    count\n  }\n  deviceTypes {\n    value\n    label\n    count\n  }\n  osTypes {\n    value\n    label\n    count\n  }\n  organizationIds {\n    value\n    label\n    count\n  }\n  tagKeys {\n    key\n    value\n    count\n  }\n  filteredCount\n}\n"
  }
};
})();

(node as any).hash = "a77e3e4d0ead00fe5008c738f3940d4d";

export default node;
