/**
 * @generated SignedSource<<f9a53b154dc83def8c5b60413700bffc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useBundleDeviceAssignmentRemoveMutation$variables = {
  bundleId: string;
  machineIds: ReadonlyArray<string>;
};
export type useBundleDeviceAssignmentRemoveMutation$data = {
  readonly removeDevicesFromSoftwareBundle: {
    readonly id: string;
  };
};
export type useBundleDeviceAssignmentRemoveMutation = {
  response: useBundleDeviceAssignmentRemoveMutation$data;
  variables: useBundleDeviceAssignmentRemoveMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "bundleId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "machineIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "bundleId",
        "variableName": "bundleId"
      },
      {
        "kind": "Variable",
        "name": "machineIds",
        "variableName": "machineIds"
      }
    ],
    "concreteType": "SoftwareBundle",
    "kind": "LinkedField",
    "name": "removeDevicesFromSoftwareBundle",
    "plural": false,
    "selections": [
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useBundleDeviceAssignmentRemoveMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useBundleDeviceAssignmentRemoveMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "0e356c4a53b6046481eb7c3b9dd4efda",
    "id": null,
    "metadata": {},
    "name": "useBundleDeviceAssignmentRemoveMutation",
    "operationKind": "mutation",
    "text": "mutation useBundleDeviceAssignmentRemoveMutation(\n  $bundleId: ID!\n  $machineIds: [ID!]!\n) {\n  removeDevicesFromSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "fb5878c86d3b025c7df16b87d82ba8c7";

export default node;
