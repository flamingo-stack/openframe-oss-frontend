/**
 * @generated SignedSource<<adaae0ed0e1aaf338efbf885f6e11a6a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TagEntityType = "DEVICE" | "KNOWLEDGE_ARTICLE" | "SCRIPT" | "TICKET" | "%future added value";
export type entityTagPickerQuery$variables = {
  entityType: TagEntityType;
};
export type entityTagPickerQuery$data = {
  readonly tagsByEntityType: ReadonlyArray<{
    readonly id: string;
    readonly key: string;
  }>;
};
export type entityTagPickerQuery = {
  response: entityTagPickerQuery$data;
  variables: entityTagPickerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "entityType"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "entityType",
        "variableName": "entityType"
      }
    ],
    "concreteType": "Tag",
    "kind": "LinkedField",
    "name": "tagsByEntityType",
    "plural": true,
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
        "name": "key",
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
    "name": "entityTagPickerQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "entityTagPickerQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "11964d5d2fa9fb378cd71d3ed8480ab9",
    "id": null,
    "metadata": {},
    "name": "entityTagPickerQuery",
    "operationKind": "query",
    "text": "query entityTagPickerQuery(\n  $entityType: TagEntityType!\n) {\n  tagsByEntityType(entityType: $entityType) {\n    id\n    key\n  }\n}\n"
  }
};
})();

(node as any).hash = "be72d64630f458ac2d4373043f866ccc";

export default node;
