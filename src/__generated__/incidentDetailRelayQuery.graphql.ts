/**
 * @generated SignedSource<<cc249fbef95528689ed7e1ab26fac20d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type incidentDetailRelayQuery$variables = {
  id: string;
};
export type incidentDetailRelayQuery$data = {
  readonly insight: {
    readonly " $fragmentSpreads": FragmentRefs<"insightFields_insight">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"insightTransitions_query">;
};
export type incidentDetailRelayQuery = {
  response: incidentDetailRelayQuery$data;
  variables: incidentDetailRelayQuery$variables;
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
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "title",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "severity",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "snoozedUntil",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "detectedAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "machineId",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "nickname",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hostname",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "organizationId",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "assigneeId",
  "storageKey": null
},
v16 = [
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
v17 = [
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
  (v6/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": "UserImage",
    "kind": "LinkedField",
    "name": "image",
    "plural": false,
    "selections": (v16/*: any*/),
    "storageKey": null
  }
],
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "interval",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queryResult",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "OrganizationImage",
  "kind": "LinkedField",
  "name": "image",
  "plural": false,
  "selections": (v16/*: any*/),
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "concreteType": "InsightStatusTransition",
  "kind": "LinkedField",
  "name": "insightStatusTransitions",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "from",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "to",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "incidentDetailRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Insight",
        "kind": "LinkedField",
        "name": "insight",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "insightFields_insight",
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "insightRowFields_insight",
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Machine",
                    "kind": "LinkedField",
                    "name": "machine",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
                      (v4/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v13/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Organization",
                    "kind": "LinkedField",
                    "name": "organization",
                    "plural": false,
                    "selections": [
                      (v2/*: any*/),
                      (v14/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v15/*: any*/),
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
                        "selections": (v17/*: any*/),
                        "args": null,
                        "argumentDefinitions": []
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "args": null,
                "argumentDefinitions": []
              },
              (v18/*: any*/),
              (v19/*: any*/),
              (v20/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Organization",
                "kind": "LinkedField",
                "name": "organization",
                "plural": false,
                "selections": [
                  (v21/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "args": null,
            "argumentDefinitions": []
          }
        ],
        "storageKey": null
      },
      {
        "kind": "InlineDataFragmentSpread",
        "name": "insightTransitions_query",
        "selections": [
          (v22/*: any*/)
        ],
        "args": null,
        "argumentDefinitions": []
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "incidentDetailRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Insight",
        "kind": "LinkedField",
        "name": "insight",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v9/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Machine",
            "kind": "LinkedField",
            "name": "machine",
            "plural": false,
            "selections": [
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v4/*: any*/),
              (v2/*: any*/)
            ],
            "storageKey": null
          },
          (v13/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Organization",
            "kind": "LinkedField",
            "name": "organization",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              (v14/*: any*/),
              (v21/*: any*/)
            ],
            "storageKey": null
          },
          (v15/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "assignee",
            "plural": false,
            "selections": (v17/*: any*/),
            "storageKey": null
          },
          (v18/*: any*/),
          (v19/*: any*/),
          (v20/*: any*/)
        ],
        "storageKey": null
      },
      (v22/*: any*/)
    ]
  },
  "params": {
    "cacheID": "74c6547ccc2d4bb2f4c07181e70402d8",
    "id": null,
    "metadata": {},
    "name": "incidentDetailRelayQuery",
    "operationKind": "query",
    "text": "query incidentDetailRelayQuery(\n  $id: ID!\n) {\n  insight(id: $id) {\n    ...insightFields_insight\n    id\n  }\n  ...insightTransitions_query\n}\n\nfragment insightFields_insight on Insight {\n  ...insightRowFields_insight\n  description\n  interval\n  queryResult\n  organization {\n    image {\n      imageUrl\n      hash\n    }\n    id\n  }\n}\n\nfragment insightRowFields_insight on Insight {\n  id\n  title\n  type\n  severity\n  status\n  snoozedUntil\n  detectedAt\n  machineId\n  machine {\n    nickname\n    hostname\n    displayName\n    type\n    id\n  }\n  organizationId\n  organization {\n    id\n    name\n  }\n  assigneeId\n  assignee {\n    ...insightUserFields_user\n    id\n  }\n}\n\nfragment insightTransitions_query on Query {\n  insightStatusTransitions {\n    from\n    to\n  }\n}\n\nfragment insightUserFields_user on User {\n  id\n  firstName\n  lastName\n  email\n  status\n  image {\n    imageUrl\n    hash\n  }\n}\n"
  }
};
})();

(node as any).hash = "9b2933aed116790fa8784baf9ef30df4";

export default node;
