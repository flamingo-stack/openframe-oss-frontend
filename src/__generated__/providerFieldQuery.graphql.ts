/**
 * @generated SignedSource<<294ac1d572d63561f26bb63b0c98db03>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
export type providerFieldQuery$variables = Record<PropertyKey, never>;
export type providerFieldQuery$data = {
  readonly directoryConnectionOptions: {
    readonly providers: ReadonlyArray<DirectoryProvider>;
  };
};
export type providerFieldQuery = {
  response: providerFieldQuery$data;
  variables: providerFieldQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DirectoryConnectionOptions",
    "kind": "LinkedField",
    "name": "directoryConnectionOptions",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "providers",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "providerFieldQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "providerFieldQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "871d5c14412a19f0aaacf8318f8c035f",
    "id": null,
    "metadata": {},
    "name": "providerFieldQuery",
    "operationKind": "query",
    "text": "query providerFieldQuery {\n  directoryConnectionOptions {\n    providers\n  }\n}\n"
  }
};
})();

(node as any).hash = "97950970e420798a1f146e49649d08b0";

export default node;
