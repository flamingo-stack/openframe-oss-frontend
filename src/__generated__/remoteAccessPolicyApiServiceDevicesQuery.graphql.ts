/**
 * @generated SignedSource<<f27182b991bf4f2a58d249a66bc010eb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiServiceDevicesQuery$variables = {
  ids: ReadonlyArray<string>;
};
export type remoteAccessPolicyApiServiceDevicesQuery$data = {
  readonly nodes: ReadonlyArray<{
    readonly machineId?: string;
    readonly remoteAccess?: {
      readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_device">;
    };
  } | null | undefined>;
};
export type remoteAccessPolicyApiServiceDevicesQuery = {
  response: remoteAccessPolicyApiServiceDevicesQuery$data;
  variables: remoteAccessPolicyApiServiceDevicesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "ids"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "ids",
    "variableName": "ids"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "machineId",
  "storageKey": null
},
v3 = [
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
    "name": "remoteAccessPolicyApiServiceDevicesQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
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
                    "selections": (v3/*: any*/),
                    "args": null,
                    "argumentDefinitions": []
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Machine",
            "abstractKey": null
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
    "name": "remoteAccessPolicyApiServiceDevicesQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "DeviceRemoteAccess",
                "kind": "LinkedField",
                "name": "remoteAccess",
                "plural": false,
                "selections": (v3/*: any*/),
                "storageKey": null
              }
            ],
            "type": "Machine",
            "abstractKey": null
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
    "cacheID": "8ad319fa78598f2befb2c7c655748bbf",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceDevicesQuery",
    "operationKind": "query",
    "text": "query remoteAccessPolicyApiServiceDevicesQuery(\n  $ids: [ID!]!\n) {\n  nodes(ids: $ids) {\n    __typename\n    ... on Machine {\n      machineId\n      remoteAccess {\n        ...remoteAccessPolicyApiService_device\n      }\n    }\n    id\n  }\n}\n\nfragment remoteAccessPolicyApiService_device on DeviceRemoteAccess {\n  mode\n  effectiveMode\n  effectiveScope\n}\n"
  }
};
})();

(node as any).hash = "6c8f059cc7c084b72097dce9acb68bfb";

export default node;
