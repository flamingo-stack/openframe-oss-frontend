/**
 * @generated SignedSource<<fb3a8c9c191463a26ecb7de0f97cf4c8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type useDraftBundleCreateMutation$variables = Record<PropertyKey, never>;
export type useDraftBundleCreateMutation$data = {
  readonly createSoftwareBundle: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"useDraftBundle_bundle">;
  };
};
export type useDraftBundleCreateMutation = {
  response: useDraftBundleCreateMutation$data;
  variables: useDraftBundleCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useDraftBundleCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SoftwareBundle",
        "kind": "LinkedField",
        "name": "createSoftwareBundle",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "useDraftBundle_bundle"
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useDraftBundleCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SoftwareBundle",
        "kind": "LinkedField",
        "name": "createSoftwareBundle",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "deviceCount",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f6ea1729ef44683cdb0dedbf42440c4e",
    "id": null,
    "metadata": {},
    "name": "useDraftBundleCreateMutation",
    "operationKind": "mutation",
    "text": "mutation useDraftBundleCreateMutation {\n  createSoftwareBundle {\n    id\n    ...useDraftBundle_bundle\n  }\n}\n\nfragment useDraftBundle_bundle on SoftwareBundle {\n  id\n  deviceCount\n}\n"
  }
};
})();

(node as any).hash = "d76c1da8c8aacb51fd0029ef68b53684";

export default node;
