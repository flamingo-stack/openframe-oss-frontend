/**
 * @generated SignedSource<<39cbb08684b28899ef7459ffb0edc99b>>
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
export type employeeWorkTimeRelay_query$data = {
  readonly employeeTimeEntries: {
    readonly edges: ReadonlyArray<{
      readonly cursor: string;
      readonly node: {
        readonly breakSeconds: Long;
        readonly createdAt: Instant | null | undefined;
        readonly durationSeconds: Long;
        readonly endedAt: Instant | null | undefined;
        readonly id: string;
        readonly notes: string | null | undefined;
        readonly organization: {
          readonly contactInformation: {
            readonly contacts: ReadonlyArray<{
              readonly email: string | null | undefined;
            }>;
          } | null | undefined;
          readonly id: string;
          readonly image: {
            readonly hash: string | null | undefined;
            readonly imageUrl: string;
          } | null | undefined;
          readonly name: string;
          readonly organizationId: string;
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
        readonly user: {
          readonly email: string | null | undefined;
          readonly firstName: string | null | undefined;
          readonly id: string;
          readonly image: {
            readonly hash: string | null | undefined;
            readonly imageUrl: string | null | undefined;
          } | null | undefined;
          readonly lastName: string | null | undefined;
          readonly status: string | null | undefined;
        } | null | undefined;
        readonly userId: string;
      };
    }>;
    readonly filteredCount: number;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "employeeWorkTimeRelay_query";
};
export type employeeWorkTimeRelay_query$key = {
  readonly " $data"?: employeeWorkTimeRelay_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"employeeWorkTimeRelay_query">;
};

import employeeWorkTimeRelayPaginationQuery_graphql from './employeeWorkTimeRelayPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "employeeTimeEntries"
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
    "args": null,
    "kind": "ScalarField",
    "name": "imageUrl",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "hash",
    "storageKey": null
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filter"
    },
    {
      "defaultValue": 20,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "search"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": employeeWorkTimeRelayPaginationQuery_graphql
    }
  },
  "name": "employeeWorkTimeRelay_query",
  "selections": [
    {
      "alias": "employeeTimeEntries",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        },
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        }
      ],
      "concreteType": "TimeEntryConnection",
      "kind": "LinkedField",
      "name": "__EmployeeWorkTime_employeeTimeEntries_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "filteredCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "TimeEntryEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "TimeEntry",
              "kind": "LinkedField",
              "name": "node",
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
                    },
                    (v3/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "OrganizationImage",
                      "kind": "LinkedField",
                      "name": "image",
                      "plural": false,
                      "selections": (v4/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ContactInformation",
                      "kind": "LinkedField",
                      "name": "contactInformation",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ContactPerson",
                          "kind": "LinkedField",
                          "name": "contacts",
                          "plural": true,
                          "selections": [
                            (v5/*: any*/)
                          ],
                          "storageKey": null
                        }
                      ],
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
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "user",
                  "plural": false,
                  "selections": [
                    (v1/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "firstName",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "lastName",
                      "storageKey": null
                    },
                    (v5/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "status",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "UserImage",
                      "kind": "LinkedField",
                      "name": "image",
                      "plural": false,
                      "selections": (v4/*: any*/),
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
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
};
})();

(node as any).hash = "957522b0c61f5c9240eae5fb485bd918";

export default node;
