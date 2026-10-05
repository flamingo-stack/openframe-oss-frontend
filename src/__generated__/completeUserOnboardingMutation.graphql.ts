/**
 * @generated SignedSource<<b665e73fa7a285f1266133a44af4f8ff>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type UserOnboardingStep = "KNOWLEDGE_MANAGEMENT" | "LOGGING" | "MEET_MINGO" | "MONITORING" | "SCRIPTING" | "TICKETS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type completeUserOnboardingMutation$variables = Record<PropertyKey, never>;
export type completeUserOnboardingMutation$data = {
  readonly completeUserOnboarding: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<UserOnboardingStep>;
    readonly skipped: boolean;
    readonly skippedAt: Instant | null | undefined;
  };
};
export type completeUserOnboardingMutation = {
  response: completeUserOnboardingMutation$data;
  variables: completeUserOnboardingMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UserOnboardingProgress",
    "kind": "LinkedField",
    "name": "completeUserOnboarding",
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
    "name": "completeUserOnboardingMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "completeUserOnboardingMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "93dddfe84a9ad652371b72fec0a23de8",
    "id": null,
    "metadata": {},
    "name": "completeUserOnboardingMutation",
    "operationKind": "mutation",
    "text": "mutation completeUserOnboardingMutation {\n  completeUserOnboarding {\n    completedSteps\n    completed\n    completedAt\n    skipped\n    skippedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "138bcdd359a2174c2e1502b721478153";

export default node;
