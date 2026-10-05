/**
 * @generated SignedSource<<2c6083f7f282af369e9d30416ebce893>>
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
export type pauseTimerMutation$variables = Record<PropertyKey, never>;
export type pauseTimerMutation$data = {
  readonly pauseTimer: {
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
export type pauseTimerMutation = {
  response: pauseTimerMutation$data;
  variables: pauseTimerMutation$variables;
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
    "name": "pauseTimer",
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
    "name": "pauseTimerMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "pauseTimerMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "83fb721a7971517fa00bb00cfe570803",
    "id": null,
    "metadata": {},
    "name": "pauseTimerMutation",
    "operationKind": "mutation",
    "text": "mutation pauseTimerMutation {\n  pauseTimer {\n    id\n    userId\n    ticketId\n    ticketNumber\n    ticketTitle\n    ticket {\n      id\n      ticketNumber\n      title\n      organizationId\n      organizationName\n    }\n    organizationId\n    organization {\n      id\n      name\n    }\n    notes\n    startedAt\n    endedAt\n    pausedAt\n    durationSeconds\n    breakSeconds\n    state\n    source\n    createdAt\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "0d18f0f8b2cf782516f0f6305ed19154";

export default node;
