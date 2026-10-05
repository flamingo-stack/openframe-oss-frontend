/**
 * @generated SignedSource<<6f6d14e046cdfeff6eb715d68caa2318>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type relayMentionChipsScheduleQuery$variables = {
  id: string;
};
export type relayMentionChipsScheduleQuery$data = {
  readonly scriptSchedule: {
    readonly name: string;
  };
};
export type relayMentionChipsScheduleQuery = {
  response: relayMentionChipsScheduleQuery$data;
  variables: relayMentionChipsScheduleQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "relayMentionChipsScheduleQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "scriptSchedule",
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
    "name": "relayMentionChipsScheduleQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ScriptSchedule",
        "kind": "LinkedField",
        "name": "scriptSchedule",
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
    "cacheID": "1ff8ca561ee3f1f2b4ffbb77dbf16a81",
    "id": null,
    "metadata": {},
    "name": "relayMentionChipsScheduleQuery",
    "operationKind": "query",
    "text": "query relayMentionChipsScheduleQuery(\n  $id: ID!\n) {\n  scriptSchedule(id: $id) {\n    name\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f4a857a370c5d78e1e39d813e50dafa0";

export default node;
