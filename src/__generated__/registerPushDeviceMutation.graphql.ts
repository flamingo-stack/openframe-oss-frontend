/**
 * @generated SignedSource<<cd6f2d60d946b031270bf7babbbd962c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type PushPlatform = "ANDROID" | "IOS" | "%future added value";
export type registerPushDeviceMutation$variables = {
  appVersion?: string | null | undefined;
  platform: PushPlatform;
  token: string;
};
export type registerPushDeviceMutation$data = {
  readonly registerPushDevice: boolean;
};
export type registerPushDeviceMutation = {
  response: registerPushDeviceMutation$data;
  variables: registerPushDeviceMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "appVersion"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "platform"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "token"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "appVersion",
        "variableName": "appVersion"
      },
      {
        "kind": "Variable",
        "name": "platform",
        "variableName": "platform"
      },
      {
        "kind": "Variable",
        "name": "token",
        "variableName": "token"
      }
    ],
    "kind": "ScalarField",
    "name": "registerPushDevice",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "registerPushDeviceMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "registerPushDeviceMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "198cbedb7253035b631f308feb2166be",
    "id": null,
    "metadata": {},
    "name": "registerPushDeviceMutation",
    "operationKind": "mutation",
    "text": "mutation registerPushDeviceMutation(\n  $token: String!\n  $platform: PushPlatform!\n  $appVersion: String\n) {\n  registerPushDevice(token: $token, platform: $platform, appVersion: $appVersion)\n}\n"
  }
};
})();

(node as any).hash = "da63ab6fcbb29af3ab3ec8a2f8bdba2b";

export default node;
