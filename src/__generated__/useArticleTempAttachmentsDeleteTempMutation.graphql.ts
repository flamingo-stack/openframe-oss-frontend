/**
 * @generated SignedSource<<b8401b92093cf016ea770ba21ab0aa52>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type MutationDeleteInput = {
  id: string;
};
export type useArticleTempAttachmentsDeleteTempMutation$variables = {
  input: MutationDeleteInput;
};
export type useArticleTempAttachmentsDeleteTempMutation$data = {
  readonly deleteKnowledgeBaseTempAttachment: {
    readonly userErrors: ReadonlyArray<{
      readonly field: ReadonlyArray<string> | null | undefined;
      readonly message: string;
    }>;
  };
};
export type useArticleTempAttachmentsDeleteTempMutation = {
  response: useArticleTempAttachmentsDeleteTempMutation$data;
  variables: useArticleTempAttachmentsDeleteTempMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "MutationDeletePayload",
    "kind": "LinkedField",
    "name": "deleteKnowledgeBaseTempAttachment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "MutationError",
        "kind": "LinkedField",
        "name": "userErrors",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "field",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "message",
            "storageKey": null
          }
        ],
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
    "name": "useArticleTempAttachmentsDeleteTempMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useArticleTempAttachmentsDeleteTempMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "94adb8654a0a233d86a3059b0ac780c0",
    "id": null,
    "metadata": {},
    "name": "useArticleTempAttachmentsDeleteTempMutation",
    "operationKind": "mutation",
    "text": "mutation useArticleTempAttachmentsDeleteTempMutation(\n  $input: MutationDeleteInput!\n) {\n  deleteKnowledgeBaseTempAttachment(input: $input) {\n    userErrors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ba9555bff7841d0f99c60e2635ed9451";

export default node;
