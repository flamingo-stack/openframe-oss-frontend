/**
 * @generated SignedSource<<92e54f0f0dc8ab580d386d6e8c56d01e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type archiveResolvedInsightsMutation$variables = Record<PropertyKey, never>;
export type archiveResolvedInsightsMutation$data = {
  readonly archiveResolvedInsights: number;
};
export type archiveResolvedInsightsMutation = {
  response: archiveResolvedInsightsMutation$data;
  variables: archiveResolvedInsightsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "archiveResolvedInsights",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "archiveResolvedInsightsMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "archiveResolvedInsightsMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "b6d32e33d2daec8404b0e0c6f5d393bc",
    "id": null,
    "metadata": {},
    "name": "archiveResolvedInsightsMutation",
    "operationKind": "mutation",
    "text": "mutation archiveResolvedInsightsMutation {\n  archiveResolvedInsights\n}\n"
  }
};
})();

(node as any).hash = "ed2448037eabc313237fc86beff2fc03";

export default node;
