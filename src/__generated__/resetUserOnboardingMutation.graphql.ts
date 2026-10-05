/**
 * @generated SignedSource<<063820680fa528a5a65451cc916db9f4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type UserOnboardingStep = "KNOWLEDGE_MANAGEMENT" | "LOGGING" | "MEET_MINGO" | "MONITORING" | "SCRIPTING" | "TICKETS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type resetUserOnboardingMutation$variables = Record<PropertyKey, never>;
export type resetUserOnboardingMutation$data = {
  readonly resetUserOnboarding: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<UserOnboardingStep>;
    readonly skipped: boolean;
    readonly skippedAt: Instant | null | undefined;
  };
};
export type resetUserOnboardingMutation = {
  response: resetUserOnboardingMutation$data;
  variables: resetUserOnboardingMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UserOnboardingProgress",
    "kind": "LinkedField",
    "name": "resetUserOnboarding",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "completedSteps",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "completed",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "completedAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "skipped",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "skippedAt",
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
    "name": "resetUserOnboardingMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "resetUserOnboardingMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "fd650c73e55e043c90bfe3c97cbff179",
    "id": null,
    "metadata": {},
    "name": "resetUserOnboardingMutation",
    "operationKind": "mutation",
    "text": "mutation resetUserOnboardingMutation {\n  resetUserOnboarding {\n    completedSteps\n    completed\n    completedAt\n    skipped\n    skippedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "04bfa7547c51c39fdd08c2fdf6f467ac";

export default node;
