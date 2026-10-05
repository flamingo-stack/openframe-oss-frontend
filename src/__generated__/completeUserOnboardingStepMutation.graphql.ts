/**
 * @generated SignedSource<<61575c92328b704a5f4ca2857cb458a0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type UserOnboardingStep = "KNOWLEDGE_MANAGEMENT" | "LOGGING" | "MEET_MINGO" | "MONITORING" | "SCRIPTING" | "TICKETS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type completeUserOnboardingStepMutation$variables = {
  step: UserOnboardingStep;
};
export type completeUserOnboardingStepMutation$data = {
  readonly completeUserOnboardingStep: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<UserOnboardingStep>;
    readonly skipped: boolean;
    readonly skippedAt: Instant | null | undefined;
  };
};
export type completeUserOnboardingStepMutation = {
  response: completeUserOnboardingStepMutation$data;
  variables: completeUserOnboardingStepMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "step"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "step",
        "variableName": "step"
      }
    ],
    "concreteType": "UserOnboardingProgress",
    "kind": "LinkedField",
    "name": "completeUserOnboardingStep",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "completeUserOnboardingStepMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "completeUserOnboardingStepMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "106f0b438b21107d206025de05eb8dc7",
    "id": null,
    "metadata": {},
    "name": "completeUserOnboardingStepMutation",
    "operationKind": "mutation",
    "text": "mutation completeUserOnboardingStepMutation(\n  $step: UserOnboardingStep!\n) {\n  completeUserOnboardingStep(step: $step) {\n    completedSteps\n    completed\n    completedAt\n    skipped\n    skippedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "e16a0fd60a32f41502c2587360543844";

export default node;
