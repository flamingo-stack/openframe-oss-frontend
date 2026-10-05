/**
 * @generated SignedSource<<4c157fb525aa725791360832c90d36fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareOnDeviceStatus = "OUTDATED" | "SCHEDULED_UNINSTALL" | "SCHEDULED_UPDATE" | "UNINSTALLING" | "UP_TO_DATE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareDevicesTable_query$data = {
  readonly softwareDevices: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly device: {
          readonly id: string;
          readonly machineId: string;
          readonly " $fragmentSpreads": FragmentRefs<"softwareDeviceCell_machine">;
        };
        readonly status: SoftwareOnDeviceStatus | null | undefined;
        readonly " $fragmentSpreads": FragmentRefs<"softwareDeviceVersionCell_softwareOnDevice">;
      };
    }>;
    readonly filteredCount: number;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "softwareDevicesTable_query";
};
export type softwareDevicesTable_query$key = {
  readonly " $data"?: softwareDevicesTable_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareDevicesTable_query">;
};

import softwareDevicesTablePaginationQuery_graphql from './softwareDevicesTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "softwareDevices"
];
return {
  "argumentDefinitions": [
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
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": softwareDevicesTablePaginationQuery_graphql
    }
  },
  "name": "softwareDevicesTable_query",
  "selections": [
    {
      "alias": "softwareDevices",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
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
      "concreteType": "SoftwareOnDeviceConnection",
      "kind": "LinkedField",
      "name": "__softwareDevicesTable_softwareDevices_connection",
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "status",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Machine",
                  "kind": "LinkedField",
                  "name": "device",
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
                      "name": "machineId",
                      "storageKey": null
                    },
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "softwareDeviceCell_machine"
                    }
                  ],
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareDeviceVersionCell_softwareOnDevice"
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "70364f2f3f183ed8862b544d78f10983";

export default node;
