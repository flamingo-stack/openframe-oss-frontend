/**
 * @generated SignedSource<<23a4314c7bbb17297efe4a2668d19c38>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type testClockPanelQuery$variables = Record<PropertyKey, never>;
export type testClockPanelQuery$data = {
  readonly testClockTime: {
    readonly frozenTime: string;
  } | null | undefined;
};
export type testClockPanelQuery = {
  response: testClockPanelQuery$data;
  variables: testClockPanelQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "TestClockResult",
    "kind": "LinkedField",
    "name": "testClockTime",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "frozenTime",
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
    "name": "testClockPanelQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "testClockPanelQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "2a3cf998fc39bcf821d84ca2a037ae7b",
    "id": null,
    "metadata": {},
    "name": "testClockPanelQuery",
    "operationKind": "query",
    "text": "query testClockPanelQuery {\n  testClockTime {\n    frozenTime\n  }\n}\n"
  }
};
})();

(node as any).hash = "052819f55d5f9789493797505b1cbddd";

export default node;
