/**
 * @generated SignedSource<<c3df7639b785b6957aa5adc08ddb972d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type unregisterPushDeviceMutation$variables = {
  token: string;
};
export type unregisterPushDeviceMutation$data = {
  readonly unregisterPushDevice: boolean;
};
export type unregisterPushDeviceMutation = {
  response: unregisterPushDeviceMutation$data;
  variables: unregisterPushDeviceMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "token"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "token",
        "variableName": "token"
      }
    ],
    "kind": "ScalarField",
    "name": "unregisterPushDevice",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "unregisterPushDeviceMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "unregisterPushDeviceMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "083511aa728e1568b4e578b3662a718a",
    "id": null,
    "metadata": {},
    "name": "unregisterPushDeviceMutation",
    "operationKind": "mutation",
    "text": "mutation unregisterPushDeviceMutation(\n  $token: String!\n) {\n  unregisterPushDevice(token: $token)\n}\n"
  }
};
})();

(node as any).hash = "0e4f20aa630f0077e1041ea1e262a0ae";

export default node;
