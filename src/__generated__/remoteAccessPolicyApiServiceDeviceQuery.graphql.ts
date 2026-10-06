/**
 * @generated SignedSource<<5635ad5c935a41dc67f707c5b01f92f7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiServiceDeviceQuery$variables = {
  machineId: string;
};
export type remoteAccessPolicyApiServiceDeviceQuery$data = {
  readonly device: {
    readonly remoteAccess: {
      readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_device">;
    };
  } | null | undefined;
};
export type remoteAccessPolicyApiServiceDeviceQuery = {
  response: remoteAccessPolicyApiServiceDeviceQuery$data;
  variables: remoteAccessPolicyApiServiceDeviceQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "machineId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "machineId",
    "variableName": "machineId"
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
    "name": "remoteAccessPolicyApiServiceDeviceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Machine",
        "kind": "LinkedField",
        "name": "device",
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "remoteAccessPolicyApiServiceDeviceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Machine",
        "kind": "LinkedField",
        "name": "device",
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
    "cacheID": "d07da868c5691a4b194bca106605b2cf",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceDeviceQuery",
    "operationKind": "query",
    "text": "query remoteAccessPolicyApiServiceDeviceQuery(\n  $machineId: String!\n) {\n  device(machineId: $machineId) {\n    remoteAccess {\n      ...remoteAccessPolicyApiService_device\n    }\n    id\n  }\n}\n\nfragment remoteAccessPolicyApiService_device on DeviceRemoteAccess {\n  mode\n  effectiveMode\n  effectiveScope\n}\n"
  }
};
})();

(node as any).hash = "9a15110130f30b06bb3d65d323c1619c";

export default node;
