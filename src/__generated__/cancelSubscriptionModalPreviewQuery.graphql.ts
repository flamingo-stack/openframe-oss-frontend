/**
 * @generated SignedSource<<94bd3c0e1d007860eca30bf013618354>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { LocalDate } from "../lib/graphql-scalars";
export type cancelSubscriptionModalPreviewQuery$variables = Record<PropertyKey, never>;
export type cancelSubscriptionModalPreviewQuery$data = {
  readonly subscriptionCancellationPreview: LocalDate | null | undefined;
};
export type cancelSubscriptionModalPreviewQuery = {
  response: cancelSubscriptionModalPreviewQuery$data;
  variables: cancelSubscriptionModalPreviewQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "subscriptionCancellationPreview",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "cancelSubscriptionModalPreviewQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "cancelSubscriptionModalPreviewQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "0a889021572b08604efd608e119c874d",
    "id": null,
    "metadata": {},
    "name": "cancelSubscriptionModalPreviewQuery",
    "operationKind": "query",
    "text": "query cancelSubscriptionModalPreviewQuery {\n  subscriptionCancellationPreview\n}\n"
  }
};
})();

(node as any).hash = "a2fcc79bdf68d661bcec22e69849e6ef";

export default node;
