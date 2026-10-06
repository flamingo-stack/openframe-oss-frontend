/**
 * @generated SignedSource<<8b0a90dc24b97f9c61c56d78bd82d7bc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type AssignInsightInput = {
  assigneeId: string;
  id: string;
};
export type assignInsightMutation$variables = {
  input: AssignInsightInput;
};
export type assignInsightMutation$data = {
  readonly assignInsight: {
    readonly assignee: {
      readonly " $fragmentSpreads": FragmentRefs<"insightUserFields_user">;
    } | null | undefined;
    readonly assigneeId: string | null | undefined;
    readonly id: string;
  };
};
export type assignInsightMutation = {
  response: assignInsightMutation$data;
  variables: assignInsightMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "assigneeId",
  "storageKey": null
},
v4 = [
  (v2/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "firstName",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "lastName",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "email",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "status",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "UserImage",
    "kind": "LinkedField",
    "name": "image",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "imageUrl",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hash",
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
    "name": "assignInsightMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Insight",
        "kind": "LinkedField",
        "name": "assignInsight",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "assignee",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "insightUserFields_user",
                "selections": (v4/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "assignInsightMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Insight",
        "kind": "LinkedField",
        "name": "assignInsight",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "assignee",
            "plural": false,
            "selections": (v4/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4ecb25e6de1b709ccfa35a17aa14009a",
    "id": null,
    "metadata": {},
    "name": "assignInsightMutation",
    "operationKind": "mutation",
    "text": "mutation assignInsightMutation(\n  $input: AssignInsightInput!\n) {\n  assignInsight(input: $input) {\n    id\n    assigneeId\n    assignee {\n      ...insightUserFields_user\n      id\n    }\n  }\n}\n\nfragment insightUserFields_user on User {\n  id\n  firstName\n  lastName\n  email\n  status\n  image {\n    imageUrl\n    hash\n  }\n}\n"
  }
};
})();

(node as any).hash = "e6c1752250a1ebb4db1c55a13121004a";

export default node;
