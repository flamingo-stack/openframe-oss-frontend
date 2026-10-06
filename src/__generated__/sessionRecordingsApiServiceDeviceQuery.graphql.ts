/**
 * @generated SignedSource<<f084956b4be71fb0382c0791cc2dc34b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type sessionRecordingsApiServiceDeviceQuery$variables = {
  machineId: string;
};
export type sessionRecordingsApiServiceDeviceQuery$data = {
  readonly device: {
    readonly hostname: string | null | undefined;
  } | null | undefined;
};
export type sessionRecordingsApiServiceDeviceQuery = {
  response: sessionRecordingsApiServiceDeviceQuery$data;
  variables: sessionRecordingsApiServiceDeviceQuery$variables;
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hostname",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionRecordingsApiServiceDeviceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Machine",
        "kind": "LinkedField",
        "name": "device",
        "plural": false,
        "selections": [
          (v2/*: any*/)
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
    "name": "sessionRecordingsApiServiceDeviceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Machine",
        "kind": "LinkedField",
        "name": "device",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
    "cacheID": "d1732e1cc425ef7e50c509b3aab4d439",
    "id": null,
    "metadata": {},
    "name": "sessionRecordingsApiServiceDeviceQuery",
    "operationKind": "query",
    "text": "query sessionRecordingsApiServiceDeviceQuery(\n  $machineId: String!\n) {\n  device(machineId: $machineId) {\n    hostname\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0332bc944b82f413ca40a807ee6db9e6";

export default node;
