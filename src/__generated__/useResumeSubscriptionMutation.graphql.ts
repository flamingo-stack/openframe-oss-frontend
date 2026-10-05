/**
 * @generated SignedSource<<627af4866d03cdd45e86efafb107f0eb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useResumeSubscriptionMutation$variables = Record<PropertyKey, never>;
export type useResumeSubscriptionMutation$data = {
  readonly resumeSubscription: boolean;
};
export type useResumeSubscriptionMutation = {
  response: useResumeSubscriptionMutation$data;
  variables: useResumeSubscriptionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "resumeSubscription",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useResumeSubscriptionMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useResumeSubscriptionMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "9c9ee4f93650f00660e2815013626dc7",
    "id": null,
    "metadata": {},
    "name": "useResumeSubscriptionMutation",
    "operationKind": "mutation",
    "text": "mutation useResumeSubscriptionMutation {\n  resumeSubscription\n}\n"
  }
};
})();

(node as any).hash = "fa94894ef7fed43e506a97989e80f48e";

export default node;
