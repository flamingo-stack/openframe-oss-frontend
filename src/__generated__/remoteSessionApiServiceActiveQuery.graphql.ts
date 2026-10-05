/**
 * @generated SignedSource<<4d056efdedaacdb992d46603191c9f60>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteSessionApiServiceActiveQuery$variables = {
  deviceId: string;
};
export type remoteSessionApiServiceActiveQuery$data = {
  readonly activeRemoteSession: {
    readonly " $fragmentSpreads": FragmentRefs<"remoteSessionApiService_session">;
  } | null | undefined;
};
export type remoteSessionApiServiceActiveQuery = {
  response: remoteSessionApiServiceActiveQuery$data;
  variables: remoteSessionApiServiceActiveQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "deviceId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "deviceId",
    "variableName": "deviceId"
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
    "name": "remoteSessionApiServiceActiveQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteSession",
        "kind": "LinkedField",
        "name": "activeRemoteSession",
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
    "name": "remoteSessionApiServiceActiveQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteSession",
        "kind": "LinkedField",
        "name": "activeRemoteSession",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9630395bc64e84bbccfcce1b2f081c21",
    "id": null,
    "metadata": {},
    "name": "remoteSessionApiServiceActiveQuery",
    "operationKind": "query",
    "text": "query remoteSessionApiServiceActiveQuery(\n  $deviceId: String!\n) {\n  activeRemoteSession(deviceId: $deviceId) {\n    ...remoteSessionApiService_session\n  }\n}\n\nfragment remoteSessionApiService_session on RemoteSession {\n  sessionId\n  requestId\n  deviceId\n  technicianId\n  mode\n  status\n  startedAt\n  endedAt\n  endReason\n  reason\n  ticketId\n  ticketNumber\n  recordingEnabled\n  dialogId\n}\n"
  }
};
})();

(node as any).hash = "be9e4494a1c28482c493d0ed5b522b01";

export default node;
