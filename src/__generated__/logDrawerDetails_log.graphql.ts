/**
 * @generated SignedSource<<0fa3053e1ac7fba543685bf1d0a8f79c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type logDrawerDetails_log$data = {
  readonly eventType: string;
  readonly ingestDay: string;
  readonly timestamp: Instant;
  readonly toolEventId: string;
  readonly toolType: string;
  readonly " $fragmentType": "logDrawerDetails_log";
};
export type logDrawerDetails_log$key = {
  readonly " $data"?: logDrawerDetails_log$data;
  readonly " $fragmentSpreads": FragmentRefs<"logDrawerDetails_log">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "logDrawerDetails_log",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "toolEventId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ingestDay",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "toolType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "eventType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timestamp",
      "storageKey": null
    }
  ],
  "type": "LogEvent",
  "abstractKey": null
};

(node as any).hash = "201189321e79051f993be1b38d2abcbb";

export default node;
