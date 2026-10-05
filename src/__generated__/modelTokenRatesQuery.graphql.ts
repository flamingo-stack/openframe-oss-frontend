/**
 * @generated SignedSource<<fca20bf64bade67859e83a52da527e49>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type AIProvider = "ANTHROPIC" | "GOOGLE_GEMINI" | "OPENAI" | "%future added value";
export type modelTokenRatesQuery$variables = Record<PropertyKey, never>;
export type modelTokenRatesQuery$data = {
  readonly aiModelRates: ReadonlyArray<{
    readonly displayName: string;
    readonly inputTokenRate: number;
    readonly modelName: string;
    readonly outputTokenRate: number;
    readonly providerType: AIProvider;
  }>;
};
export type modelTokenRatesQuery = {
  response: modelTokenRatesQuery$data;
  variables: modelTokenRatesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AiModelRate",
    "kind": "LinkedField",
    "name": "aiModelRates",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "modelName",
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
        "name": "providerType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "inputTokenRate",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "outputTokenRate",
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
    "name": "modelTokenRatesQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "modelTokenRatesQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "3ab8f84ec1fd40f896bac36e03fce87f",
    "id": null,
    "metadata": {},
    "name": "modelTokenRatesQuery",
    "operationKind": "query",
    "text": "query modelTokenRatesQuery {\n  aiModelRates {\n    modelName\n    displayName\n    providerType\n    inputTokenRate\n    outputTokenRate\n  }\n}\n"
  }
};
})();

(node as any).hash = "9cd54ef776b7dcd982f6d2787d7ddc24";

export default node;
