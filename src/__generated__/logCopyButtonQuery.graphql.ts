/**
 * @generated SignedSource<<cd7a338b0f7b12b3ea63cf550909af6d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
import type { Instant } from "../lib/graphql-scalars";
export type logCopyButtonQuery$variables = {
  eventType: string;
  ingestDay: string;
  timestamp: Instant;
  toolEventId: string;
  toolType: string;
};
export type logCopyButtonQuery$data = {
  readonly logDetails: {
    readonly " $fragmentSpreads": FragmentRefs<"formatLogDetails_log">;
  } | null | undefined;
};
export type logCopyButtonQuery = {
  response: logCopyButtonQuery$data;
  variables: logCopyButtonQuery$variables;
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
    "name": "logCopyButtonQuery",
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
      (v3/*: any*/),
      (v1/*: any*/),
      (v4/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "logCopyButtonQuery",
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
    "cacheID": "b1bd178efc7afa1db513b2fa44f97311",
    "id": null,
    "metadata": {},
    "name": "logCopyButtonQuery",
    "operationKind": "query",
    "text": "query logCopyButtonQuery(\n  $toolEventId: String!\n  $ingestDay: String!\n  $toolType: String!\n  $eventType: String!\n  $timestamp: Instant!\n) {\n  logDetails(toolEventId: $toolEventId, ingestDay: $ingestDay, toolType: $toolType, eventType: $eventType, timestamp: $timestamp) {\n    ...formatLogDetails_log\n    id\n  }\n}\n\nfragment formatLogDetails_log on LogDetails {\n  toolEventId\n  severity\n  timestamp\n  toolType\n  eventType\n  message\n  details\n}\n"
  }
};
})();

(node as any).hash = "52f12d8c190bfd09c3617f2bcc265cf9";

export default node;
