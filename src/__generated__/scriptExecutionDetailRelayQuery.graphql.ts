/**
 * @generated SignedSource<<e728bc1cd075b524645bba7d49717186>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type ExecutionSource = "AI_ASSISTANT" | "MANUAL" | "SCHEDULED" | "%future added value";
export type PrivilegeLevel = "ADMIN" | "ELEVATED_USER" | "USER" | "%future added value";
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type scriptExecutionDetailRelayQuery$variables = {
  id: string;
};
export type scriptExecutionDetailRelayQuery$data = {
  readonly node: {
    readonly dispatchedAt?: Instant;
    readonly error?: string | null | undefined;
    readonly executionId?: string;
    readonly executionTimeMs?: number | null | undefined;
    readonly exitCode?: number | null | undefined;
    readonly finishedAt?: Instant | null | undefined;
    readonly id?: string;
    readonly initiator?: {
      readonly email: string | null | undefined;
      readonly firstName: string | null | undefined;
      readonly id: string;
      readonly image: {
        readonly hash: string | null | undefined;
        readonly imageUrl: string | null | undefined;
      } | null | undefined;
      readonly lastName: string | null | undefined;
      readonly status: string | null | undefined;
    } | null | undefined;
    readonly machine?: {
      readonly displayName: string | null | undefined;
      readonly hostname: string | null | undefined;
      readonly id: string;
      readonly machineId: string;
      readonly nickname: string | null | undefined;
      readonly organization: {
        readonly id: string;
        readonly name: string;
      } | null | undefined;
      readonly timezone: string | null | undefined;
    } | null | undefined;
    readonly privilegeLevel?: PrivilegeLevel;
    readonly scriptId?: string;
    readonly scriptName?: string | null | undefined;
    readonly source?: ExecutionSource;
    readonly status?: ScriptExecutionStatus;
    readonly statusChangedAt?: Instant | null | undefined;
    readonly stderr?: string | null | undefined;
    readonly stdout?: string | null | undefined;
    readonly timedOut?: boolean | null | undefined;
  } | null | undefined;
};
export type scriptExecutionDetailRelayQuery = {
  response: scriptExecutionDetailRelayQuery$data;
  variables: scriptExecutionDetailRelayQuery$variables;
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
  "name": "executionId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "scriptId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "scriptName",
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
  "name": "source",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "privilegeLevel",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "dispatchedAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusChangedAt",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "finishedAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "executionTimeMs",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "exitCode",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timedOut",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stdout",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stderr",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "Machine",
  "kind": "LinkedField",
  "name": "machine",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "machineId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "nickname",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hostname",
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
      "name": "timezone",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Organization",
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
      "selections": [
        (v2/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "initiator",
  "plural": false,
  "selections": [
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
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "scriptExecutionDetailRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              (v18/*: any*/),
              (v19/*: any*/)
            ],
            "type": "ScriptExecution",
            "abstractKey": null
          }
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
    "name": "scriptExecutionDetailRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              (v18/*: any*/),
              (v19/*: any*/)
            ],
            "type": "ScriptExecution",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "36d0d7feb5993e362a456e0afd9e8af7",
    "id": null,
    "metadata": {},
    "name": "scriptExecutionDetailRelayQuery",
    "operationKind": "query",
    "text": "query scriptExecutionDetailRelayQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on ScriptExecution {\n      id\n      executionId\n      scriptId\n      scriptName\n      status\n      source\n      privilegeLevel\n      dispatchedAt\n      statusChangedAt\n      finishedAt\n      executionTimeMs\n      exitCode\n      timedOut\n      stdout\n      stderr\n      error\n      machine {\n        id\n        machineId\n        nickname\n        hostname\n        displayName\n        timezone\n        organization {\n          id\n          name\n        }\n      }\n      initiator {\n        id\n        firstName\n        lastName\n        email\n        status\n        image {\n          imageUrl\n          hash\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "bb89bd1826ee0cc927cc03c7e1d3a469";

export default node;
