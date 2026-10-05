/**
 * @generated SignedSource<<6c8c8081efdb8a5a3f14fe2d88fbb6ed>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareVulnerabilitiesTable_query$data = {
  readonly softwareVulnerabilities: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly affectedVersion: string | null | undefined;
        readonly cveId: string;
        readonly " $fragmentSpreads": FragmentRefs<"softwareVulnerabilityDiscoveredCell_vulnerability" | "softwareVulnerabilityVersionCell_vulnerability">;
      };
    }>;
    readonly filteredCount: number;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "softwareVulnerabilitiesTable_query";
};
export type softwareVulnerabilitiesTable_query$key = {
  readonly " $data"?: softwareVulnerabilitiesTable_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareVulnerabilitiesTable_query">;
};

import softwareVulnerabilitiesTablePaginationQuery_graphql from './softwareVulnerabilitiesTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "softwareVulnerabilities"
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
      "operation": softwareVulnerabilitiesTablePaginationQuery_graphql
    }
  },
  "name": "softwareVulnerabilitiesTable_query",
  "selections": [
    {
      "alias": "softwareVulnerabilities",
      "args": [
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
      "concreteType": "SoftwareVulnerabilityConnection",
      "kind": "LinkedField",
      "name": "__softwareVulnerabilitiesTable_softwareVulnerabilities_connection",
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
          "concreteType": "SoftwareVulnerabilityEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "SoftwareVulnerability",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cveId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "affectedVersion",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareVulnerabilityVersionCell_vulnerability"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareVulnerabilityDiscoveredCell_vulnerability"
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

(node as any).hash = "489de72204e5decf4a6f7c4e426bd117";

export default node;
