/**
 * @generated SignedSource<<9fcbb69d57354ee856f304e21e8f5649>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type scheduleScriptsPickerRelayQuery$variables = {
  first: number;
  platforms?: ReadonlyArray<OsType> | null | undefined;
  search?: string | null | undefined;
};
export type scheduleScriptsPickerRelayQuery$data = {
  readonly scripts: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly defaultArgs: ReadonlyArray<string> | null | undefined;
        readonly defaultTimeoutSeconds: number | null | undefined;
        readonly envVars: ReadonlyArray<{
          readonly name: string;
          readonly secret: boolean;
          readonly value: string | null | undefined;
        }> | null | undefined;
        readonly id: string;
        readonly name: string;
        readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
      };
    }>;
  };
};
export type scheduleScriptsPickerRelayQuery = {
  response: scheduleScriptsPickerRelayQuery$data;
  variables: scheduleScriptsPickerRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "platforms"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Literal",
            "name": "statuses",
            "value": [
              "ACTIVE"
            ]
          },
          {
            "kind": "Variable",
            "name": "supportedPlatforms",
            "variableName": "platforms"
          }
        ],
        "kind": "ObjectValue",
        "name": "filter"
      },
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      },
      {
        "kind": "Variable",
        "name": "search",
        "variableName": "search"
      }
    ],
    "concreteType": "ScriptConnection",
    "kind": "LinkedField",
    "name": "scripts",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Script",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "supportedPlatforms",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "defaultTimeoutSeconds",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "defaultArgs",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ScriptEnvVar",
                "kind": "LinkedField",
                "name": "envVars",
                "plural": true,
                "selections": [
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "value",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "secret",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "scheduleScriptsPickerRelayQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "scheduleScriptsPickerRelayQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "ba30f96ea6fcb32ef9d6d5ea7b9aff5e",
    "id": null,
    "metadata": {},
    "name": "scheduleScriptsPickerRelayQuery",
    "operationKind": "query",
    "text": "query scheduleScriptsPickerRelayQuery(\n  $search: String\n  $platforms: [OsType!]\n  $first: Int!\n) {\n  scripts(filter: {statuses: [ACTIVE], supportedPlatforms: $platforms}, search: $search, first: $first) {\n    edges {\n      node {\n        id\n        name\n        supportedPlatforms\n        defaultTimeoutSeconds\n        defaultArgs\n        envVars {\n          name\n          value\n          secret\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "78854c8936df62ee6fc5c05d58107899";

export default node;
