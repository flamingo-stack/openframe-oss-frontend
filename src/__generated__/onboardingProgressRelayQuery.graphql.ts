/**
 * @generated SignedSource<<c5775368a05185d6aae5a67a1400042e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TenantOnboardingStep = "CUSTOMERS_SETUP" | "DEVICE_MANAGEMENT" | "MEET_MINGO" | "MSP_SETUP" | "%future added value";
export type UserOnboardingStep = "KNOWLEDGE_MANAGEMENT" | "LOGGING" | "MEET_MINGO" | "MONITORING" | "SCRIPTING" | "TICKETS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type onboardingProgressRelayQuery$variables = Record<PropertyKey, never>;
export type onboardingProgressRelayQuery$data = {
  readonly tenantOnboardingProgress: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<TenantOnboardingStep>;
  };
  readonly userOnboardingProgress: {
    readonly completed: boolean;
    readonly completedAt: Instant | null | undefined;
    readonly completedSteps: ReadonlyArray<UserOnboardingStep>;
    readonly skipped: boolean;
    readonly skippedAt: Instant | null | undefined;
  };
};
export type onboardingProgressRelayQuery = {
  response: onboardingProgressRelayQuery$data;
  variables: onboardingProgressRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completedSteps",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completed",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completedAt",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "TenantOnboardingProgress",
    "kind": "LinkedField",
    "name": "tenantOnboardingProgress",
    "plural": false,
    "selections": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "UserOnboardingProgress",
    "kind": "LinkedField",
    "name": "userOnboardingProgress",
    "plural": false,
    "selections": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
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
    "name": "onboardingProgressRelayQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "onboardingProgressRelayQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "0d4bc812f0ba43d03fd874bf959c2186",
    "id": null,
    "metadata": {},
    "name": "onboardingProgressRelayQuery",
    "operationKind": "query",
    "text": "query onboardingProgressRelayQuery {\n  tenantOnboardingProgress {\n    completedSteps\n    completed\n    completedAt\n  }\n  userOnboardingProgress {\n    completedSteps\n    completed\n    completedAt\n    skipped\n    skippedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "4c618a903808b3e04e220471162b1154";

export default node;
