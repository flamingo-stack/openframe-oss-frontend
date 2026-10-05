/**
 * @generated SignedSource<<59da0a5fc9009e326c92a8953a2c0bda>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type NotificationSettingGroup = "ADMIN_REPLIED" | "APPROVAL_MINGO" | "APPROVAL_TICKET" | "CUSTOMER_REPLIED" | "INSIGHTS" | "MINGO_MESSAGES" | "TICKET_ASSIGNED" | "TICKET_CREATED" | "TICKET_STATUS_CHANGED" | "%future added value";
export type NotificationTypeSettingInput = {
  enabled: boolean;
  group: NotificationSettingGroup;
};
export type notificationSettingsModalMutation$variables = {
  enabled: boolean;
  typeSettings?: ReadonlyArray<NotificationTypeSettingInput> | null | undefined;
};
export type notificationSettingsModalMutation$data = {
  readonly updateNotificationSettings: {
    readonly enabled: boolean;
    readonly typeSettings: ReadonlyArray<{
      readonly enabled: boolean;
      readonly group: NotificationSettingGroup;
    }>;
  };
};
export type notificationSettingsModalMutation = {
  response: notificationSettingsModalMutation$data;
  variables: notificationSettingsModalMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "enabled"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "typeSettings"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "enabled",
        "variableName": "enabled"
      },
      {
        "kind": "Variable",
        "name": "typeSettings",
        "variableName": "typeSettings"
      }
    ],
    "concreteType": "NotificationSettings",
    "kind": "LinkedField",
    "name": "updateNotificationSettings",
    "plural": false,
    "selections": [
      (v1/*: any*/),
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
          (v1/*: any*/)
        ],
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
    "name": "notificationSettingsModalMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "notificationSettingsModalMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "0e0bfc2ed4c9d1ce42ed8c16a214b15a",
    "id": null,
    "metadata": {},
    "name": "notificationSettingsModalMutation",
    "operationKind": "mutation",
    "text": "mutation notificationSettingsModalMutation(\n  $enabled: Boolean!\n  $typeSettings: [NotificationTypeSettingInput!]\n) {\n  updateNotificationSettings(enabled: $enabled, typeSettings: $typeSettings) {\n    enabled\n    typeSettings {\n      group\n      enabled\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3b074610517116493e347164f606315b";

export default node;
