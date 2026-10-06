/**
 * @generated SignedSource<<c80e505acde3e65d5984e3b6a60eaed5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
export type remoteAccessPolicyApiServiceSetDeviceMutation$variables = {
  machineId: string;
  mode?: RemoteAccessMode | null | undefined;
};
export type remoteAccessPolicyApiServiceSetDeviceMutation$data = {
  readonly setDeviceRemoteAccessMode: {
    readonly remoteAccess: {
      readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_device">;
    };
  };
};
export type remoteAccessPolicyApiServiceSetDeviceMutation = {
  response: remoteAccessPolicyApiServiceSetDeviceMutation$data;
  variables: remoteAccessPolicyApiServiceSetDeviceMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "machineId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "mode"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "machineId",
    "variableName": "machineId"
  },
  {
    "kind": "Variable",
    "name": "mode",
    "variableName": "mode"
  }
],
v2 = [
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
    "name": "effectiveMode",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "effectiveScope",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessPolicyApiServiceSetDeviceMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Machine",
        "kind": "LinkedField",
        "name": "setDeviceRemoteAccessMode",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DeviceRemoteAccess",
            "kind": "LinkedField",
            "name": "remoteAccess",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "remoteAccessPolicyApiService_device",
                "selections": (v2/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          }
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
    "name": "remoteAccessPolicyApiServiceSetDeviceMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Machine",
        "kind": "LinkedField",
        "name": "setDeviceRemoteAccessMode",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DeviceRemoteAccess",
            "kind": "LinkedField",
            "name": "remoteAccess",
            "plural": false,
            "selections": (v2/*: any*/),
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
    "cacheID": "aaec8de77bd43a755d1244accb482762",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceSetDeviceMutation",
    "operationKind": "mutation",
    "text": "mutation remoteAccessPolicyApiServiceSetDeviceMutation(\n  $machineId: String!\n  $mode: RemoteAccessMode\n) {\n  setDeviceRemoteAccessMode(machineId: $machineId, mode: $mode) {\n    remoteAccess {\n      ...remoteAccessPolicyApiService_device\n    }\n    id\n  }\n}\n\nfragment remoteAccessPolicyApiService_device on DeviceRemoteAccess {\n  mode\n  effectiveMode\n  effectiveScope\n}\n"
  }
};
})();

(node as any).hash = "72e455620dfc7aab0e7a62435b4213d4";

export default node;
