/**
 * @generated SignedSource<<59cf464ba92a7ed1c68b97cd338706b6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type PrivilegeLevel = "ADMIN" | "ELEVATED_USER" | "USER" | "%future added value";
export type ScriptShell = "BASH" | "CMD" | "NUSHELL" | "POWERSHELL" | "PYTHON" | "SHELL" | "%future added value";
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type scriptDetailRelayQuery$variables = {
  id: string;
};
export type scriptDetailRelayQuery$data = {
  readonly script: {
    readonly author: {
      readonly email: string | null | undefined;
      readonly firstName: string | null | undefined;
      readonly id: string;
      readonly lastName: string | null | undefined;
    } | null | undefined;
    readonly defaultArgs: ReadonlyArray<string> | null | undefined;
    readonly defaultTimeoutSeconds: number | null | undefined;
    readonly description: string | null | undefined;
    readonly envVars: ReadonlyArray<{
      readonly name: string;
      readonly secret: boolean;
      readonly value: string | null | undefined;
    }> | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly privilegeLevel: PrivilegeLevel;
    readonly scriptBody: string;
    readonly shell: ScriptShell;
    readonly status: ScriptStatus;
    readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
    readonly tags: ReadonlyArray<{
      readonly id: string;
      readonly key: string;
    }>;
  };
};
export type scriptDetailRelayQuery = {
  response: scriptDetailRelayQuery$data;
  variables: scriptDetailRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Script",
    "kind": "LinkedField",
    "name": "script",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/),
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
        "name": "shell",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "privilegeLevel",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "scriptBody",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Tag",
        "kind": "LinkedField",
        "name": "tags",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "key",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
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
          (v2/*: any*/),
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
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "author",
        "plural": false,
        "selections": [
          (v1/*: any*/),
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
    "name": "scriptDetailRelayQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptDetailRelayQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "10ba8e0276ba0a9d6bacce55131ee647",
    "id": null,
    "metadata": {},
    "name": "scriptDetailRelayQuery",
    "operationKind": "query",
    "text": "query scriptDetailRelayQuery(\n  $id: ID!\n) {\n  script(id: $id) {\n    id\n    name\n    description\n    shell\n    privilegeLevel\n    scriptBody\n    tags {\n      id\n      key\n    }\n    supportedPlatforms\n    defaultTimeoutSeconds\n    defaultArgs\n    envVars {\n      name\n      value\n      secret\n    }\n    status\n    author {\n      id\n      firstName\n      lastName\n      email\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3ccf8195ff4bc7bf7c9d9a90e108d0c4";

export default node;
