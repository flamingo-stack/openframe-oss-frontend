/**
 * @generated SignedSource<<03c04a1e655a4f4614cdbf6d928431e9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type updateDeviceNicknameMutation$variables = {
  machineId: string;
  nickname?: string | null | undefined;
};
export type updateDeviceNicknameMutation$data = {
  readonly updateDeviceNickname: {
    readonly displayName: string | null | undefined;
    readonly hostname: string | null | undefined;
    readonly id: string;
    readonly nickname: string | null | undefined;
  };
};
export type updateDeviceNicknameMutation = {
  response: updateDeviceNicknameMutation$data;
  variables: updateDeviceNicknameMutation$variables;
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
    "name": "nickname"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "machineId",
        "variableName": "machineId"
      },
      {
        "kind": "Variable",
        "name": "nickname",
        "variableName": "nickname"
      }
    ],
    "concreteType": "Machine",
    "kind": "LinkedField",
    "name": "updateDeviceNickname",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "nickname",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "displayName",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hostname",
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
    "name": "updateDeviceNicknameMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "updateDeviceNicknameMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "469cffcc67d75d2d904637a4e232c672",
    "id": null,
    "metadata": {},
    "name": "updateDeviceNicknameMutation",
    "operationKind": "mutation",
    "text": "mutation updateDeviceNicknameMutation(\n  $machineId: String!\n  $nickname: String\n) {\n  updateDeviceNickname(machineId: $machineId, nickname: $nickname) {\n    id\n    nickname\n    displayName\n    hostname\n  }\n}\n"
  }
};
})();

(node as any).hash = "ff20e560639819d2b8f252eef5aee0ba";

export default node;
