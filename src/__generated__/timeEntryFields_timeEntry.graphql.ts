/**
 * @generated SignedSource<<883389d9d4498dbb221efc8f5deb5085>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type TimeEntrySource = "MANUAL" | "TIMER" | "%future added value";
export type TimerState = "COMPLETED" | "PAUSED" | "RUNNING" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type timeEntryFields_timeEntry$data = {
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
  readonly " $fragmentType": "timeEntryFields_timeEntry";
};
export type timeEntryFields_timeEntry$key = {
  readonly " $data"?: timeEntryFields_timeEntry$data;
  readonly " $fragmentSpreads": FragmentRefs<"timeEntryFields_timeEntry">;
};

const node: ReaderFragment = (function(){
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
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "timeEntryFields_timeEntry",
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
  "type": "TimeEntry",
  "abstractKey": null
};
})();

(node as any).hash = "08c9bafb0d6f6845609dbf895623b55a";

export default node;
