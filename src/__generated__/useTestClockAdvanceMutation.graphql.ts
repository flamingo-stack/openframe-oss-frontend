/**
 * @generated SignedSource<<93b63f1fb4b42acda19ebbbf739e0aea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useTestClockAdvanceMutation$variables = {
  days?: number | null | undefined;
  hours?: number | null | undefined;
};
export type useTestClockAdvanceMutation$data = {
  readonly advanceTestClock: {
    readonly frozenTime: string;
  } | null | undefined;
};
export type useTestClockAdvanceMutation = {
  response: useTestClockAdvanceMutation$data;
  variables: useTestClockAdvanceMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "days"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "hours"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "days",
        "variableName": "days"
      },
      {
        "kind": "Variable",
        "name": "hours",
        "variableName": "hours"
      }
    ],
    "concreteType": "TestClockResult",
    "kind": "LinkedField",
    "name": "advanceTestClock",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useTestClockAdvanceMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useTestClockAdvanceMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "698acd043dc445066f8b4cdeb6fd173f",
    "id": null,
    "metadata": {},
    "name": "useTestClockAdvanceMutation",
    "operationKind": "mutation",
    "text": "mutation useTestClockAdvanceMutation(\n  $days: Int\n  $hours: Int\n) {\n  advanceTestClock(days: $days, hours: $hours) {\n    frozenTime\n  }\n}\n"
  }
};
})();

(node as any).hash = "145db8d7014b8610437ec17d167ef45e";

export default node;
