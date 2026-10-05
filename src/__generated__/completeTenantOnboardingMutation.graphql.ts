/**
 * @generated SignedSource<<4cdc7b135bfa24a55bb59700ccac0c18>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TenantOnboardingStep = "CUSTOMERS_SETUP" | "DEVICE_MANAGEMENT" | "MEET_MINGO" | "MSP_SETUP" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type completeTenantOnboardingMutation$variables = Record<PropertyKey, never>;
export type completeTenantOnboardingMutation$data = {
  readonly completeTenantOnboarding: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<TenantOnboardingStep>;
  };
};
export type completeTenantOnboardingMutation = {
  response: completeTenantOnboardingMutation$data;
  variables: completeTenantOnboardingMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "TenantOnboardingProgress",
    "kind": "LinkedField",
    "name": "completeTenantOnboarding",
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "completeTenantOnboardingMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "completeTenantOnboardingMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "051e76dc99d1e6b2959f9107cb5ef9b1",
    "id": null,
    "metadata": {},
    "name": "completeTenantOnboardingMutation",
    "operationKind": "mutation",
    "text": "mutation completeTenantOnboardingMutation {\n  completeTenantOnboarding {\n    completedSteps\n    completed\n    completedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "3cd95443756b744aa7e5d34e539134da";

export default node;
