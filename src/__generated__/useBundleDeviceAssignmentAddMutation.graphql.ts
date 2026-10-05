/**
 * @generated SignedSource<<26e6aacaa2da87413280d09d441509ff>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useBundleDeviceAssignmentAddMutation$variables = {
  bundleId: string;
  machineIds: ReadonlyArray<string>;
};
export type useBundleDeviceAssignmentAddMutation$data = {
  readonly addDevicesToSoftwareBundle: {
    readonly id: string;
  };
};
export type useBundleDeviceAssignmentAddMutation = {
  response: useBundleDeviceAssignmentAddMutation$data;
  variables: useBundleDeviceAssignmentAddMutation$variables;
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
    "name": "addDevicesToSoftwareBundle",
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
    "name": "useBundleDeviceAssignmentAddMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useBundleDeviceAssignmentAddMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "63fa10375c92375e4d7ca05e6d11276e",
    "id": null,
    "metadata": {},
    "name": "useBundleDeviceAssignmentAddMutation",
    "operationKind": "mutation",
    "text": "mutation useBundleDeviceAssignmentAddMutation(\n  $bundleId: ID!\n  $machineIds: [ID!]!\n) {\n  addDevicesToSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f09e28fe7e24c8f2ce74c7131a98cf93";

export default node;
