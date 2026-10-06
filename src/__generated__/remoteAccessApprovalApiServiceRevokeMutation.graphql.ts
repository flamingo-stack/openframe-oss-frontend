/**
 * @generated SignedSource<<ffbf61bb35debc8bedcb4fc83802ae96>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type remoteAccessApprovalApiServiceRevokeMutation$variables = {
  requestId: string;
};
export type remoteAccessApprovalApiServiceRevokeMutation$data = {
  readonly revokeRemoteAccessRequest: {
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type remoteAccessApprovalApiServiceRevokeMutation = {
  response: remoteAccessApprovalApiServiceRevokeMutation$data;
  variables: remoteAccessApprovalApiServiceRevokeMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "requestId",
        "variableName": "requestId"
      }
    ],
    "concreteType": "RemoteAccessRequestPayload",
    "kind": "LinkedField",
    "name": "revokeRemoteAccessRequest",
    "plural": false,
    "selections": [
      {
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
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessApprovalApiServiceRevokeMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "remoteAccessApprovalApiServiceRevokeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "743c23057e90e59e79e339782349c77b",
    "id": null,
    "metadata": {},
    "name": "remoteAccessApprovalApiServiceRevokeMutation",
    "operationKind": "mutation",
    "text": "mutation remoteAccessApprovalApiServiceRevokeMutation(\n  $requestId: String!\n) {\n  revokeRemoteAccessRequest(requestId: $requestId) {\n    userErrors {\n      code\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "64882c068da7155443d4b06657eb2ee6";

export default node;
