/**
 * @generated SignedSource<<cbe9917e6ebf0ea8367a1e9a59dd585e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessApprovalApiServiceRequestQuery$variables = {
  requestId: string;
};
export type remoteAccessApprovalApiServiceRequestQuery$data = {
  readonly remoteAccessRequest: {
    readonly " $fragmentSpreads": FragmentRefs<"remoteAccessApprovalApiService_request">;
  };
};
export type remoteAccessApprovalApiServiceRequestQuery = {
  response: remoteAccessApprovalApiServiceRequestQuery$data;
  variables: remoteAccessApprovalApiServiceRequestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "requestId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "requestId",
    "variableName": "requestId"
  }
],
v2 = [
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
    "name": "status",
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
    "name": "decisionSource",
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
    "name": "createdAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "deliveredAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "expiresAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "resolvedAt",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessApprovalApiServiceRequestQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteAccessRequest",
        "kind": "LinkedField",
        "name": "remoteAccessRequest",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "remoteAccessApprovalApiService_request",
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
    "name": "remoteAccessApprovalApiServiceRequestQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteAccessRequest",
        "kind": "LinkedField",
        "name": "remoteAccessRequest",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "13058b377e60ca65941a89e7a697b437",
    "id": null,
    "metadata": {},
    "name": "remoteAccessApprovalApiServiceRequestQuery",
    "operationKind": "query",
    "text": "query remoteAccessApprovalApiServiceRequestQuery(\n  $requestId: String!\n) {\n  remoteAccessRequest(requestId: $requestId) {\n    ...remoteAccessApprovalApiService_request\n  }\n}\n\nfragment remoteAccessApprovalApiService_request on RemoteAccessRequest {\n  requestId\n  deviceId\n  technicianId\n  status\n  mode\n  decisionSource\n  reason\n  ticketId\n  ticketNumber\n  recordingEnabled\n  createdAt\n  deliveredAt\n  expiresAt\n  resolvedAt\n}\n"
  }
};
})();

(node as any).hash = "098e16a634788b63e98ae145ece46111";

export default node;
