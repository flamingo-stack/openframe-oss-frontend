/**
 * @generated SignedSource<<c5d87d7d664fa227616491b11b1c5e1b>>
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
export type CreateTimeEntryInput = {
  durationSeconds: Long;
  notes?: string | null | undefined;
  organizationId?: string | null | undefined;
  startedAt: Instant;
  ticketId?: string | null | undefined;
  userId: string;
};
export type createTimeEntryMutation$variables = {
  input: CreateTimeEntryInput;
};
export type createTimeEntryMutation$data = {
  readonly createTimeEntry: {
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
export type createTimeEntryMutation = {
  response: createTimeEntryMutation$data;
  variables: createTimeEntryMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "ticketNumber",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "organizationId",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "TimeEntry",
    "kind": "LinkedField",
    "name": "createTimeEntry",
    "plural": false,
    "selections": [
      (v1/*: any*/),
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
      (v2/*: any*/),
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
          (v1/*: any*/),
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "title",
            "storageKey": null
          },
          (v3/*: any*/),
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
      (v3/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "Organization",
        "kind": "LinkedField",
        "name": "organization",
        "plural": false,
        "selections": [
          (v1/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "createTimeEntryMutation",
    "selections": (v4/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "createTimeEntryMutation",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "0df72a80d40d3f5cead4b6447206638a",
    "id": null,
    "metadata": {},
    "name": "createTimeEntryMutation",
    "operationKind": "mutation",
    "text": "mutation createTimeEntryMutation(\n  $input: CreateTimeEntryInput!\n) {\n  createTimeEntry(input: $input) {\n    id\n    userId\n    ticketId\n    ticketNumber\n    ticketTitle\n    ticket {\n      id\n      ticketNumber\n      title\n      organizationId\n      organizationName\n    }\n    organizationId\n    organization {\n      id\n      name\n    }\n    notes\n    startedAt\n    endedAt\n    pausedAt\n    durationSeconds\n    breakSeconds\n    state\n    source\n    createdAt\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "799981b3b820672ed57f81a24af5c0fd";

export default node;
