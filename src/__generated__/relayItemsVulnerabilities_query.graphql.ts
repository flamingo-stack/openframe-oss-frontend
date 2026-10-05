/**
 * @generated SignedSource<<9475b9d51896bf03a5e8e83125213409>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type relayItemsVulnerabilities_query$data = {
  readonly vulnerabilities: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly cveId: string;
      };
    }>;
  };
  readonly " $fragmentType": "relayItemsVulnerabilities_query";
};
export type relayItemsVulnerabilities_query$key = {
  readonly " $data"?: relayItemsVulnerabilities_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsVulnerabilities_query">;
};

import relayItemsVulnerabilitiesPaginationQuery_graphql from './relayItemsVulnerabilitiesPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "vulnerabilities"
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 10,
      "kind": "LocalArgument",
      "name": "first"
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
      "operation": relayItemsVulnerabilitiesPaginationQuery_graphql
    }
  },
  "name": "relayItemsVulnerabilities_query",
  "selections": [
    {
      "alias": "vulnerabilities",
      "args": [
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        }
      ],
      "concreteType": "VulnerabilityConnection",
      "kind": "LinkedField",
      "name": "__relayItemsVulnerabilities_vulnerabilities_connection",
      "plural": false,
      "selections": [
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
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
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

(node as any).hash = "fdb35d7bc060c0a258cab8b43103f0f6";

export default node;
