/**
 * @generated SignedSource<<d76569678e2c11b98fe1a802aee397d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareLogsTable_query$data = {
  readonly softwareExecutions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly machine: {
          readonly " $fragmentSpreads": FragmentRefs<"softwareLogCustomerCell_machine" | "softwareLogDeviceCell_machine">;
        } | null | undefined;
        readonly status: ScriptExecutionStatus;
        readonly " $fragmentSpreads": FragmentRefs<"softwareLogResultPanel_execution" | "softwareLogSearch_execution" | "softwareLogStatusCell_execution">;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "softwareLogsTable_query";
};
export type softwareLogsTable_query$key = {
  readonly " $data"?: softwareLogsTable_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogsTable_query">;
};

import softwareLogsTablePaginationQuery_graphql from './softwareLogsTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "softwareExecutions"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "action"
    },
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
      "name": "packageManager"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "packageName"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "search"
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
      "operation": softwareLogsTablePaginationQuery_graphql
    }
  },
  "name": "softwareLogsTable_query",
  "selections": [
    {
      "alias": "softwareExecutions",
      "args": [
        {
          "kind": "Variable",
          "name": "action",
          "variableName": "action"
        },
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        },
        {
          "kind": "Variable",
          "name": "packageManager",
          "variableName": "packageManager"
        },
        {
          "kind": "Variable",
          "name": "packageName",
          "variableName": "packageName"
        },
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        },
        {
          "kind": "Variable",
          "name": "sort",
          "variableName": "sort"
        }
      ],
      "concreteType": "ScriptExecutionConnection",
      "kind": "LinkedField",
      "name": "__softwareLogsTable_softwareExecutions_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ScriptExecutionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ScriptExecution",
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
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Machine",
                  "kind": "LinkedField",
                  "name": "machine",
                  "plural": false,
                  "selections": [
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "softwareLogDeviceCell_machine"
                    },
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "softwareLogCustomerCell_machine"
                    }
                  ],
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareLogStatusCell_execution"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareLogResultPanel_execution"
                },
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "softwareLogSearch_execution",
                  "selections": [
                    (v1/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "stdout",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "stderr",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "error",
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
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "ContactInformation",
                              "kind": "LinkedField",
                              "name": "contactInformation",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "ContactPerson",
                                  "kind": "LinkedField",
                                  "name": "contacts",
                                  "plural": true,
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "email",
                                      "storageKey": null
                                    }
                                  ],
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "args": null,
                  "argumentDefinitions": []
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

(node as any).hash = "6a94c7b6a8744e81127202972e885975";

export default node;
