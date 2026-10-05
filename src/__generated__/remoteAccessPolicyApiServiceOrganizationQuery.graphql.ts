/**
 * @generated SignedSource<<c95ed0470c0e750ecd903bef9103757d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiServiceOrganizationQuery$variables = {
  organizationId: string;
};
export type remoteAccessPolicyApiServiceOrganizationQuery$data = {
  readonly organizationRemoteAccessPolicy: {
    readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_organization">;
  };
};
export type remoteAccessPolicyApiServiceOrganizationQuery = {
  response: remoteAccessPolicyApiServiceOrganizationQuery$data;
  variables: remoteAccessPolicyApiServiceOrganizationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "organizationId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "organizationId",
    "variableName": "organizationId"
  }
],
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mode",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "effectiveMode",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessPolicyApiServiceOrganizationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "OrganizationRemoteAccessPolicy",
        "kind": "LinkedField",
        "name": "organizationRemoteAccessPolicy",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "remoteAccessPolicyApiService_organization",
            "selections": (v2/*: any*/),
            "args": null,
            "argumentDefinitions": []
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "remoteAccessPolicyApiServiceOrganizationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "OrganizationRemoteAccessPolicy",
        "kind": "LinkedField",
        "name": "organizationRemoteAccessPolicy",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "31fa7ff4116b87ee9048a49363b3cd02",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceOrganizationQuery",
    "operationKind": "query",
    "text": "query remoteAccessPolicyApiServiceOrganizationQuery(\n  $organizationId: String!\n) {\n  organizationRemoteAccessPolicy(organizationId: $organizationId) {\n    ...remoteAccessPolicyApiService_organization\n  }\n}\n\nfragment remoteAccessPolicyApiService_organization on OrganizationRemoteAccessPolicy {\n  mode\n  effectiveMode\n}\n"
  }
};
})();

(node as any).hash = "9cffd8f78a9edc806ec3b567c5d564a8";

export default node;
