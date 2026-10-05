/**
 * @generated SignedSource<<abf15d450cf312eee6a40fd8f52b151b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteSessionApiServiceSessionQuery$variables = {
  sessionId: string;
};
export type remoteSessionApiServiceSessionQuery$data = {
  readonly remoteSession: {
    readonly " $fragmentSpreads": FragmentRefs<"remoteSessionApiService_session">;
  };
};
export type remoteSessionApiServiceSessionQuery = {
  response: remoteSessionApiServiceSessionQuery$data;
  variables: remoteSessionApiServiceSessionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sessionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "sessionId",
    "variableName": "sessionId"
  }
],
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "sessionId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "requestId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "deviceId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "technicianId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mode",
    "storageKey": null
  },
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
    "kind": "ScalarField",
    "name": "startedAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "endedAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "endReason",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "reason",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "ticketId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "ticketNumber",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "recordingEnabled",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "dialogId",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteSessionApiServiceSessionQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteSession",
        "kind": "LinkedField",
        "name": "remoteSession",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "remoteSessionApiService_session",
            "selections": (v2/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "remoteSessionApiServiceSessionQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteSession",
        "kind": "LinkedField",
        "name": "remoteSession",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c2856dfe0a3c3e02165ad9b351e20090",
    "id": null,
    "metadata": {},
    "name": "remoteSessionApiServiceSessionQuery",
    "operationKind": "query",
    "text": "query remoteSessionApiServiceSessionQuery(\n  $sessionId: String!\n) {\n  remoteSession(sessionId: $sessionId) {\n    ...remoteSessionApiService_session\n  }\n}\n\nfragment remoteSessionApiService_session on RemoteSession {\n  sessionId\n  requestId\n  deviceId\n  technicianId\n  mode\n  status\n  startedAt\n  endedAt\n  endReason\n  reason\n  ticketId\n  ticketNumber\n  recordingEnabled\n  dialogId\n}\n"
  }
};
})();

(node as any).hash = "30534f289491106072cf1fdc5cf13cc1";

export default node;
