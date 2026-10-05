/**
 * @generated SignedSource<<9f0388ef9c797bd6087aad9132f01784>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TimeEntrySource = "MANUAL" | "TIMER" | "%future added value";
export type TimerState = "COMPLETED" | "PAUSED" | "RUNNING" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type resumeTimerMutation$variables = Record<PropertyKey, never>;
export type resumeTimerMutation$data = {
  readonly resumeTimer: {
    readonly breakSeconds: Long;
    readonly createdAt: Instant | null | undefined;
    readonly durationSeconds: Long;
    readonly endedAt: Instant | null | undefined;
    readonly id: string;
    readonly notes: string | null | undefined;
    readonly organization: {
      readonly id: string;
      readonly name: string;
    } | null | undefined;
    readonly organizationId: string | null | undefined;
    readonly pausedAt: Instant | null | undefined;
    readonly source: TimeEntrySource;
    readonly startedAt: Instant;
    readonly state: TimerState;
    readonly ticket: {
      readonly id: string;
      readonly organizationId: string | null | undefined;
      readonly organizationName: string | null | undefined;
      readonly ticketNumber: number | null | undefined;
      readonly title: string | null | undefined;
    } | null | undefined;
    readonly ticketId: string | null | undefined;
    readonly ticketNumber: number | null | undefined;
    readonly ticketTitle: string | null | undefined;
    readonly updatedAt: Instant | null | undefined;
    readonly userId: string;
  };
};
export type resumeTimerMutation = {
  response: resumeTimerMutation$data;
  variables: resumeTimerMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "ticketNumber",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "organizationId",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "TimeEntry",
    "kind": "LinkedField",
    "name": "resumeTimer",
    "plural": false,
    "selections": [
      (v0/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "userId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "ticketId",
        "storageKey": null
      },
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "ticketTitle",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Ticket",
        "kind": "LinkedField",
        "name": "ticket",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "title",
            "storageKey": null
          },
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "organizationName",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "Organization",
        "kind": "LinkedField",
        "name": "organization",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "notes",
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
        "name": "endedAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "pausedAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "durationSeconds",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "breakSeconds",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "state",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "source",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "createdAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "updatedAt",
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
    "name": "resumeTimerMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "resumeTimerMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "2f99cff269a7a0978eb6b3eb4653f53e",
    "id": null,
    "metadata": {},
    "name": "resumeTimerMutation",
    "operationKind": "mutation",
    "text": "mutation resumeTimerMutation {\n  resumeTimer {\n    id\n    userId\n    ticketId\n    ticketNumber\n    ticketTitle\n    ticket {\n      id\n      ticketNumber\n      title\n      organizationId\n      organizationName\n    }\n    organizationId\n    organization {\n      id\n      name\n    }\n    notes\n    startedAt\n    endedAt\n    pausedAt\n    durationSeconds\n    breakSeconds\n    state\n    source\n    createdAt\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "4e6c914d9e103778b356c686a6481b30";

export default node;
