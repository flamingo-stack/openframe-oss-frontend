/**
 * @generated SignedSource<<2050effa76d1b1d89a93a89ee9f49de7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type sessionRecordingsApiServiceDetailQuery$variables = {
  recordingId: string;
};
export type sessionRecordingsApiServiceDetailQuery$data = {
  readonly remoteSessionRecording: {
    readonly recordingId: string;
    readonly session: {
      readonly " $fragmentSpreads": FragmentRefs<"sessionRecordingsApiService_session">;
    };
  };
};
export type sessionRecordingsApiServiceDetailQuery = {
  response: sessionRecordingsApiServiceDetailQuery$data;
  variables: sessionRecordingsApiServiceDetailQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "recordingId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "recordingId",
    "variableName": "recordingId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "recordingId",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "sessionId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "deviceId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "startedAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "durationMs",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "recordingState",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "dialogId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "RemoteAccessTechnician",
    "kind": "LinkedField",
    "name": "technician",
    "plural": false,
    "selections": [
      (v3/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "avatarUrl",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "RemoteAccessOrganization",
    "kind": "LinkedField",
    "name": "organization",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "organizationId",
        "storageKey": null
      },
      (v3/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "logoUrl",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "RemoteSessionRecording",
    "kind": "LinkedField",
    "name": "recordings",
    "plural": true,
    "selections": [
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "sizeBytes",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "protocol",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "downloadUrl",
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
    "name": "sessionRecordingsApiServiceDetailQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteSessionRecording",
        "kind": "LinkedField",
        "name": "remoteSessionRecording",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "RemoteSession",
            "kind": "LinkedField",
            "name": "session",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "sessionRecordingsApiService_session",
                "selections": (v4/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
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
    "name": "sessionRecordingsApiServiceDetailQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RemoteSessionRecording",
        "kind": "LinkedField",
        "name": "remoteSessionRecording",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "RemoteSession",
            "kind": "LinkedField",
            "name": "session",
            "plural": false,
            "selections": (v4/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a2d03e3f0a549008ba661fee29e4e690",
    "id": null,
    "metadata": {},
    "name": "sessionRecordingsApiServiceDetailQuery",
    "operationKind": "query",
    "text": "query sessionRecordingsApiServiceDetailQuery(\n  $recordingId: String!\n) {\n  remoteSessionRecording(recordingId: $recordingId) {\n    recordingId\n    session {\n      ...sessionRecordingsApiService_session\n    }\n  }\n}\n\nfragment sessionRecordingsApiService_session on RemoteSession {\n  sessionId\n  deviceId\n  startedAt\n  durationMs\n  recordingState\n  dialogId\n  technician {\n    name\n    avatarUrl\n  }\n  organization {\n    organizationId\n    name\n    logoUrl\n  }\n  recordings {\n    recordingId\n    sizeBytes\n    protocol\n    downloadUrl\n  }\n}\n"
  }
};
})();

(node as any).hash = "d049d21c88ab6e5ec6fd1228b737cb68";

export default node;
