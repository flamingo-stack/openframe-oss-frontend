/**
 * @generated SignedSource<<2a9a2d472b40ca8523daa9fe305a6101>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
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
export type deviceFiltersRelayQuery$variables = {
  filter?: DeviceFilterInput | null | undefined;
};
export type deviceFiltersRelayQuery$data = {
  readonly deviceFilters: {
    readonly deviceTypes: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly filteredCount: number;
    readonly organizationIds: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly osTypes: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly statuses: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly tagKeys: ReadonlyArray<{
      readonly count: number;
      readonly key: string;
      readonly value: string;
    }>;
  };
};
export type deviceFiltersRelayQuery = {
  response: deviceFiltersRelayQuery$data;
  variables: deviceFiltersRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v3 = [
  (v1/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "label",
    "storageKey": null
  },
  (v2/*: any*/)
],
v4 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "filter",
        "variableName": "filter"
      }
    ],
    "concreteType": "DeviceFilters",
    "kind": "LinkedField",
    "name": "deviceFilters",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DeviceFilterOption",
        "kind": "LinkedField",
        "name": "statuses",
        "plural": true,
        "selections": (v3/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "DeviceFilterOption",
        "kind": "LinkedField",
        "name": "deviceTypes",
        "plural": true,
        "selections": (v3/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "DeviceFilterOption",
        "kind": "LinkedField",
        "name": "osTypes",
        "plural": true,
        "selections": (v3/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "DeviceFilterOption",
        "kind": "LinkedField",
        "name": "organizationIds",
        "plural": true,
        "selections": (v3/*: any*/),
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
          (v1/*: any*/),
          (v2/*: any*/)
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
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "deviceFiltersRelayQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deviceFiltersRelayQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "ba20eb7b372fef78a564005036d7bc83",
    "id": null,
    "metadata": {},
    "name": "deviceFiltersRelayQuery",
    "operationKind": "query",
    "text": "query deviceFiltersRelayQuery(\n  $filter: DeviceFilterInput\n) {\n  deviceFilters(filter: $filter) {\n    statuses {\n      value\n      label\n      count\n    }\n    deviceTypes {\n      value\n      label\n      count\n    }\n    osTypes {\n      value\n      label\n      count\n    }\n    organizationIds {\n      value\n      label\n      count\n    }\n    tagKeys {\n      key\n      value\n      count\n    }\n    filteredCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "337ff245fa61233ea5a3aa42355ceaaa";

export default node;
