/**
 * @generated SignedSource<<34b8f23d7e623c6e405485257778202c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TagEntityType = "DEVICE" | "KNOWLEDGE_ARTICLE" | "SCRIPT" | "TICKET" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useTagMutations_CreateTagMutation$variables = {
  color?: string | null | undefined;
  description?: string | null | undefined;
  entityType: string;
  key: string;
};
export type useTagMutations_CreateTagMutation$data = {
  readonly createTag: {
    readonly color: string | null | undefined;
    readonly createdAt: Instant | null | undefined;
    readonly description: string | null | undefined;
    readonly entityType: TagEntityType | null | undefined;
    readonly id: string;
    readonly key: string;
  };
};
export type useTagMutations_CreateTagMutation = {
  response: useTagMutations_CreateTagMutation$data;
  variables: useTagMutations_CreateTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "color"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "entityType"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "key"
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "color",
        "variableName": "color"
      },
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "entityType",
        "variableName": "entityType"
      },
      {
        "kind": "Variable",
        "name": "key",
        "variableName": "key"
      }
    ],
    "concreteType": "Tag",
    "kind": "LinkedField",
    "name": "createTag",
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
        "name": "key",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "description",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "color",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "entityType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "createdAt",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useTagMutations_CreateTagMutation",
    "selections": (v4/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "useTagMutations_CreateTagMutation",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "771cbdd0c11d2f12edebf8a815c9032e",
    "id": null,
    "metadata": {},
    "name": "useTagMutations_CreateTagMutation",
    "operationKind": "mutation",
    "text": "mutation useTagMutations_CreateTagMutation(\n  $key: String!\n  $entityType: String!\n  $description: String\n  $color: String\n) {\n  createTag(key: $key, entityType: $entityType, description: $description, color: $color) {\n    id\n    key\n    description\n    color\n    entityType\n    createdAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "c3ca5bd2131aed02f30f66cd76c15680";

export default node;
