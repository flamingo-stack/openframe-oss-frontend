/**
 * @generated SignedSource<<a5bdb4868a16b4bc2ff8c35899fcae2e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type insightChatPromptRelayQuery$variables = {
  id: string;
};
export type insightChatPromptRelayQuery$data = {
  readonly insightChatPrompt: string;
};
export type insightChatPromptRelayQuery = {
  response: insightChatPromptRelayQuery$data;
  variables: insightChatPromptRelayQuery$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "kind": "ScalarField",
    "name": "insightChatPrompt",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "insightChatPromptRelayQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "insightChatPromptRelayQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "22671d189e9b4dcd2343ea7cbff84913",
    "id": null,
    "metadata": {},
    "name": "insightChatPromptRelayQuery",
    "operationKind": "query",
    "text": "query insightChatPromptRelayQuery(\n  $id: ID!\n) {\n  insightChatPrompt(id: $id)\n}\n"
  }
};
})();

(node as any).hash = "e84acda1aeae6028255219bb79e2a289";

export default node;
