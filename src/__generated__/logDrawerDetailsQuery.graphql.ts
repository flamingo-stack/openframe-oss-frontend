/**
 * @generated SignedSource<<a0d5966cce8c9f570176d2a79d05ea88>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
import type { Instant } from "../lib/graphql-scalars";
export type logDrawerDetailsQuery$variables = {
  eventType: string;
  ingestDay: string;
  timestamp: Instant;
  toolEventId: string;
  toolType: string;
};
export type logDrawerDetailsQuery$data = {
  readonly logDetails: {
    readonly " $fragmentSpreads": FragmentRefs<"formatLogDetails_log">;
  } | null | undefined;
};
export type logDrawerDetailsQuery = {
  response: logDrawerDetailsQuery$data;
  variables: logDrawerDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "eventType"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "ingestDay"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timestamp"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "toolEventId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "toolType"
},
v5 = [
  {
    "kind": "Variable",
    "name": "eventType",
    "variableName": "eventType"
  },
  {
    "kind": "Variable",
    "name": "ingestDay",
    "variableName": "ingestDay"
  },
  {
    "kind": "Variable",
    "name": "timestamp",
    "variableName": "timestamp"
  },
  {
    "kind": "Variable",
    "name": "toolEventId",
    "variableName": "toolEventId"
  },
  {
    "kind": "Variable",
    "name": "toolType",
    "variableName": "toolType"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolEventId",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "severity",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolType",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "eventType",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "message",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "details",
  "storageKey": null
};
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
    "name": "logDrawerDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
        "concreteType": "LogDetails",
        "kind": "LinkedField",
        "name": "logDetails",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "formatLogDetails_log",
            "selections": [
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/)
            ],
            "args": null,
            "argumentDefinitions": []
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
      (v1/*: any*/),
      (v4/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "logDrawerDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
        "concreteType": "LogDetails",
        "kind": "LinkedField",
        "name": "logDetails",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v9/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
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
    "cacheID": "60a8c9b8bd189e09e9b1d7777d807054",
    "id": null,
    "metadata": {},
    "name": "logDrawerDetailsQuery",
    "operationKind": "query",
    "text": "query logDrawerDetailsQuery(\n  $ingestDay: String!\n  $toolType: String!\n  $eventType: String!\n  $timestamp: Instant!\n  $toolEventId: String!\n) {\n  logDetails(ingestDay: $ingestDay, toolType: $toolType, eventType: $eventType, timestamp: $timestamp, toolEventId: $toolEventId) {\n    ...formatLogDetails_log\n    id\n  }\n}\n\nfragment formatLogDetails_log on LogDetails {\n  toolEventId\n  severity\n  timestamp\n  toolType\n  eventType\n  message\n  details\n}\n"
  }
};
})();

(node as any).hash = "13ab58a028675677c6ec3f53bc087625";

export default node;
