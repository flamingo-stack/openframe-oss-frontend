/**
 * @generated SignedSource<<455a462f02f51b0fa7786c46d0e7ed9b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceVulnerabilitiesTable_query$data = {
  readonly deviceVulnerabilities: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"vulnerabilityTable_vulnerability">;
      };
    }>;
    readonly filteredCount: number;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "deviceVulnerabilitiesTable_query";
};
export type deviceVulnerabilitiesTable_query$key = {
  readonly " $data"?: deviceVulnerabilitiesTable_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceVulnerabilitiesTable_query">;
};

import deviceVulnerabilitiesTablePaginationQuery_graphql from './deviceVulnerabilitiesTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "deviceVulnerabilities"
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 20,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "machineId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "search"
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
      "operation": deviceVulnerabilitiesTablePaginationQuery_graphql
    }
  },
  "name": "deviceVulnerabilitiesTable_query",
  "selections": [
    {
      "alias": "deviceVulnerabilities",
      "args": [
        {
          "kind": "Variable",
          "name": "machineId",
          "variableName": "machineId"
        },
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        }
      ],
      "concreteType": "VulnerabilityConnection",
      "kind": "LinkedField",
      "name": "__deviceVulnerabilitiesTable_deviceVulnerabilities_connection",
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
          "concreteType": "VulnerabilityEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Vulnerability",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "vulnerabilityTable_vulnerability"
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

(node as any).hash = "bf80179026709f8404dbbf3214998645";

export default node;
