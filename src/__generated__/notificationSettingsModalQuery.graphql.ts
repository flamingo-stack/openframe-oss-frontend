/**
 * @generated SignedSource<<e0fe11ac3bc22be56641b5c8e8c3ad38>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type NotificationSettingGroup = "ADMIN_REPLIED" | "APPROVAL_MINGO" | "APPROVAL_TICKET" | "CUSTOMER_REPLIED" | "INSIGHTS" | "MINGO_MESSAGES" | "TICKET_ASSIGNED" | "TICKET_CREATED" | "TICKET_STATUS_CHANGED" | "%future added value";
export type notificationSettingsModalQuery$variables = Record<PropertyKey, never>;
export type notificationSettingsModalQuery$data = {
  readonly notificationSettings: {
    readonly enabled: boolean;
    readonly typeSettings: ReadonlyArray<{
      readonly enabled: boolean;
      readonly group: NotificationSettingGroup;
      readonly label: string;
    }>;
  };
};
export type notificationSettingsModalQuery = {
  response: notificationSettingsModalQuery$data;
  variables: notificationSettingsModalQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v1 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "NotificationSettings",
    "kind": "LinkedField",
    "name": "notificationSettings",
    "plural": false,
    "selections": [
      (v0/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "NotificationTypeSetting",
        "kind": "LinkedField",
        "name": "typeSettings",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "group",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "label",
            "storageKey": null
          },
          (v0/*: any*/)
        ],
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
    "name": "notificationSettingsModalQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "notificationSettingsModalQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1348135226eebcf5936ca981bc7ecd2d",
    "id": null,
    "metadata": {},
    "name": "notificationSettingsModalQuery",
    "operationKind": "query",
    "text": "query notificationSettingsModalQuery {\n  notificationSettings {\n    enabled\n    typeSettings {\n      group\n      label\n      enabled\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5dc05ffe0746acfae3deecc08ae5527f";

export default node;
