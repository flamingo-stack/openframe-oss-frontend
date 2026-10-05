/**
 * @generated SignedSource<<2383b4b96ecfd7023aac101faddfd968>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
export type UpdateInsightNoteInput = {
  content: string;
  id: string;
};
export type updateInsightNoteMutation$variables = {
  input: UpdateInsightNoteInput;
};
export type updateInsightNoteMutation$data = {
  readonly updateInsightNote: {
    readonly content: string;
    readonly id: string;
    readonly updatedAt: Instant | null | undefined;
  };
};
export type updateInsightNoteMutation = {
  response: updateInsightNoteMutation$data;
  variables: updateInsightNoteMutation$variables;
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
    "concreteType": "InsightNote",
    "kind": "LinkedField",
    "name": "updateInsightNote",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "content",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "updatedAt",
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
    "name": "updateInsightNoteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "updateInsightNoteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bd559440421f538df400798e79f4df13",
    "id": null,
    "metadata": {},
    "name": "updateInsightNoteMutation",
    "operationKind": "mutation",
    "text": "mutation updateInsightNoteMutation(\n  $input: UpdateInsightNoteInput!\n) {\n  updateInsightNote(input: $input) {\n    id\n    content\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "c88ce3611416176e544e99f9309c68f9";

export default node;
