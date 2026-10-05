/**
 * @generated SignedSource<<c20351be22f18dbbd5efa9ac1a0377e0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TenantOnboardingStep = "CUSTOMERS_SETUP" | "DEVICE_MANAGEMENT" | "MEET_MINGO" | "MSP_SETUP" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type completeTenantOnboardingStepMutation$variables = {
  step: TenantOnboardingStep;
};
export type completeTenantOnboardingStepMutation$data = {
  readonly completeTenantOnboardingStep: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<TenantOnboardingStep>;
  };
};
export type completeTenantOnboardingStepMutation = {
  response: completeTenantOnboardingStepMutation$data;
  variables: completeTenantOnboardingStepMutation$variables;
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
    "concreteType": "TenantOnboardingProgress",
    "kind": "LinkedField",
    "name": "completeTenantOnboardingStep",
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
    "name": "completeTenantOnboardingStepMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "completeTenantOnboardingStepMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "745c2c595958e5c31aef07087d8c64cb",
    "id": null,
    "metadata": {},
    "name": "completeTenantOnboardingStepMutation",
    "operationKind": "mutation",
    "text": "mutation completeTenantOnboardingStepMutation(\n  $step: TenantOnboardingStep!\n) {\n  completeTenantOnboardingStep(step: $step) {\n    completedSteps\n    completed\n    completedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "900c682eff6d0e7aa52c88ad25340980";

export default node;
