/**
 * @generated SignedSource<<36538296856cdd4aaccbbf3e55450116>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type DeviceFilterInput = {
  deviceTypes?: ReadonlyArray<DeviceType> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  osTypes?: ReadonlyArray<string> | null | undefined;
  statuses?: ReadonlyArray<DeviceStatus> | null | undefined;
  tagKeys?: ReadonlyArray<string> | null | undefined;
  tagValues?: ReadonlyArray<string> | null | undefined;
};
export type tenantOnboardingAutoDetectRelayQuery$variables = {
  deviceFilter?: DeviceFilterInput | null | undefined;
};
export type tenantOnboardingAutoDetectRelayQuery$data = {
  readonly deviceFilters: {
    readonly filteredCount: number;
  };
  readonly organizations: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly isDefault: boolean;
      };
    }>;
  };
  readonly tenantInfo: {
    readonly image: {
      readonly imageUrl: string;
    } | null | undefined;
    readonly name: string | null | undefined;
    readonly website: string | null | undefined;
  } | null | undefined;
};
export type tenantOnboardingAutoDetectRelayQuery = {
  response: tenantOnboardingAutoDetectRelayQuery$data;
  variables: tenantOnboardingAutoDetectRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "deviceFilter"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "website",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "Image",
  "kind": "LinkedField",
  "name": "image",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "imageUrl",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 2
    }
  ],
  "concreteType": "OrganizationConnection",
  "kind": "LinkedField",
  "name": "organizations",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "OrganizationEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "Organization",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v4/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "isDefault",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "organizations(first:2)"
},
v6 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "filter",
      "variableName": "deviceFilter"
    }
  ],
  "concreteType": "DeviceFilters",
  "kind": "LinkedField",
  "name": "deviceFilters",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "filteredCount",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "tenantOnboardingAutoDetectRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TenantInfo",
        "kind": "LinkedField",
        "name": "tenantInfo",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      (v5/*: any*/),
      (v6/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "tenantOnboardingAutoDetectRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TenantInfo",
        "kind": "LinkedField",
        "name": "tenantInfo",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      (v5/*: any*/),
      (v6/*: any*/)
    ]
  },
  "params": {
    "cacheID": "c516500b2079fcb47d605ee217788091",
    "id": null,
    "metadata": {},
    "name": "tenantOnboardingAutoDetectRelayQuery",
    "operationKind": "query",
    "text": "query tenantOnboardingAutoDetectRelayQuery(\n  $deviceFilter: DeviceFilterInput\n) {\n  tenantInfo {\n    name\n    website\n    image {\n      imageUrl\n    }\n    id\n  }\n  organizations(first: 2) {\n    edges {\n      node {\n        id\n        isDefault\n      }\n    }\n  }\n  deviceFilters(filter: $deviceFilter) {\n    filteredCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "3e5f97d8a5f3e589dad55e6a00148dab";

export default node;
