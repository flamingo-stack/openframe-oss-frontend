/**
 * @generated SignedSource<<4f05eedcb2d8071e9d56dcf43544ad8f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type InsightSeverity = "CRITICAL" | "HIGH" | "INFO" | "LOW" | "MEDIUM" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type relayItemsIncidents_query$data = {
  readonly insights: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly machine: {
          readonly displayName: string | null | undefined;
          readonly hostname: string | null | undefined;
          readonly nickname: string | null | undefined;
        } | null | undefined;
        readonly severity: InsightSeverity;
        readonly title: string;
      };
    }>;
  };
  readonly " $fragmentType": "relayItemsIncidents_query";
};
export type relayItemsIncidents_query$key = {
  readonly " $data"?: relayItemsIncidents_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsIncidents_query">;
};

import relayItemsIncidentsPaginationQuery_graphql from './relayItemsIncidentsPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "insights"
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
      "operation": relayItemsIncidentsPaginationQuery_graphql
    }
  },
  "name": "relayItemsIncidents_query",
  "selections": [
    {
      "alias": "insights",
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
        }
      ],
      "concreteType": "InsightConnection",
      "kind": "LinkedField",
      "name": "__relayItemsIncidents_insights_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "InsightEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Insight",
              "kind": "LinkedField",
              "name": "node",
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
                  "name": "title",
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
                  "concreteType": "Machine",
                  "kind": "LinkedField",
                  "name": "machine",
                  "plural": false,
                  "selections": [
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
                      "name": "hostname",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "displayName",
                      "storageKey": null
                    }
                  ],
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

(node as any).hash = "5f1fb4ff3a09bfbc5620f029a7ba05f1";

export default node;
