/**
 * @generated SignedSource<<dd336d75b1bbfa613385ce006df03d96>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type UserOnboardingStep = "KNOWLEDGE_MANAGEMENT" | "LOGGING" | "MEET_MINGO" | "MONITORING" | "SCRIPTING" | "TICKETS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type skipUserOnboardingMutation$variables = Record<PropertyKey, never>;
export type skipUserOnboardingMutation$data = {
  readonly skipUserOnboarding: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<UserOnboardingStep>;
    readonly skipped: boolean;
    readonly skippedAt: Instant | null | undefined;
  };
};
export type skipUserOnboardingMutation = {
  response: skipUserOnboardingMutation$data;
  variables: skipUserOnboardingMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UserOnboardingProgress",
    "kind": "LinkedField",
    "name": "skipUserOnboarding",
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
    "name": "skipUserOnboardingMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "skipUserOnboardingMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "dae605d9e97237f5d5092a486ab47b66",
    "id": null,
    "metadata": {},
    "name": "skipUserOnboardingMutation",
    "operationKind": "mutation",
    "text": "mutation skipUserOnboardingMutation {\n  skipUserOnboarding {\n    completedSteps\n    completed\n    completedAt\n    skipped\n    skippedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "6e0c5281fe65a6d15443e2522341cd01";

export default node;
