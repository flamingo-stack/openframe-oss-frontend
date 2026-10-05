/**
 * @generated SignedSource<<32e6a8ff6ef564b14ac2c725ecedf783>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareActionDetailViewQuery$variables = {
  id: string;
};
export type softwareActionDetailViewQuery$data = {
  readonly softwareAction: {
    readonly " $fragmentSpreads": FragmentRefs<"actionDetailHeader_action" | "actionDetailLogs_action" | "actionDetailSummary_action">;
  } | null | undefined;
};
export type softwareActionDetailViewQuery = {
  response: softwareActionDetailViewQuery$data;
  variables: softwareActionDetailViewQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareActionDetailViewQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareActionRun",
        "kind": "LinkedField",
        "name": "softwareAction",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "actionDetailHeader_action"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "actionDetailSummary_action"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "actionDetailLogs_action"
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
    "name": "softwareActionDetailViewQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareActionRun",
        "kind": "LinkedField",
        "name": "softwareAction",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "action",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "software",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "engine",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "respondedMachineCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalMachineCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "executionId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ce210cccefcb3e3c64eed4d12eaab19d",
    "id": null,
    "metadata": {},
    "name": "softwareActionDetailViewQuery",
    "operationKind": "query",
    "text": "query softwareActionDetailViewQuery(\n  $id: ID!\n) {\n  softwareAction(id: $id) {\n    ...actionDetailHeader_action\n    ...actionDetailSummary_action\n    ...actionDetailLogs_action\n    id\n  }\n}\n\nfragment actionDetailHeader_action on SoftwareActionRun {\n  action\n}\n\nfragment actionDetailLogs_action on SoftwareActionRun {\n  executionId\n  software\n  engine\n  action\n}\n\nfragment actionDetailSummary_action on SoftwareActionRun {\n  software\n  engine\n  action\n  respondedMachineCount\n  totalMachineCount\n}\n"
  }
};
})();

(node as any).hash = "6a1b7da1ce7fcf8f78a49c469678cc41";

export default node;
