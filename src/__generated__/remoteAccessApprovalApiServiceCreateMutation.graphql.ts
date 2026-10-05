/**
 * @generated SignedSource<<8fe3f1aa44c81061ebb394593cd73720>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type RemoteSessionKind = "DESKTOP" | "%future added value";
export type CreateRemoteAccessRequestInput = {
  deviceId: string;
  reason?: string | null | undefined;
  sessionKind: RemoteSessionKind;
  ticketId?: string | null | undefined;
};
export type remoteAccessApprovalApiServiceCreateMutation$variables = {
  input: CreateRemoteAccessRequestInput;
};
export type remoteAccessApprovalApiServiceCreateMutation$data = {
  readonly createRemoteAccessRequest: {
    readonly request: {
      readonly " $fragmentSpreads": FragmentRefs<"remoteAccessApprovalApiService_request">;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type remoteAccessApprovalApiServiceCreateMutation = {
  response: remoteAccessApprovalApiServiceCreateMutation$data;
  variables: remoteAccessApprovalApiServiceCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "UserError",
  "kind": "LinkedField",
  "name": "userErrors",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "code",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "message",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessApprovalApiServiceCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteAccessRequestPayload",
        "kind": "LinkedField",
        "name": "createRemoteAccessRequest",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "RemoteAccessRequest",
            "kind": "LinkedField",
            "name": "request",
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
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "remoteAccessApprovalApiServiceCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteAccessRequestPayload",
        "kind": "LinkedField",
        "name": "createRemoteAccessRequest",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "RemoteAccessRequest",
            "kind": "LinkedField",
            "name": "request",
            "plural": false,
            "selections": (v2/*: any*/),
            "storageKey": null
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5502e8c324ab9a2a864c45faf7cb7c50",
    "id": null,
    "metadata": {},
    "name": "remoteAccessApprovalApiServiceCreateMutation",
    "operationKind": "mutation",
    "text": "mutation remoteAccessApprovalApiServiceCreateMutation(\n  $input: CreateRemoteAccessRequestInput!\n) {\n  createRemoteAccessRequest(input: $input) {\n    request {\n      ...remoteAccessApprovalApiService_request\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n\nfragment remoteAccessApprovalApiService_request on RemoteAccessRequest {\n  requestId\n  deviceId\n  technicianId\n  status\n  mode\n  decisionSource\n  reason\n  ticketId\n  ticketNumber\n  recordingEnabled\n  createdAt\n  deliveredAt\n  expiresAt\n  resolvedAt\n}\n"
  }
};
})();

(node as any).hash = "60ebaa547e45ff6d1b92d817c92ca374";

export default node;
