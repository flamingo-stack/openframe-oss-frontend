/**
 * @generated SignedSource<<de9c4155951478a2022e9a4c3588a7d6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type logCopyButton_log$data = {
  readonly eventType: string;
  readonly ingestDay: string;
  readonly timestamp: Instant;
  readonly toolEventId: string;
  readonly toolType: string;
  readonly " $fragmentType": "logCopyButton_log";
};
export type logCopyButton_log$key = {
  readonly " $data"?: logCopyButton_log$data;
  readonly " $fragmentSpreads": FragmentRefs<"logCopyButton_log">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "logCopyButton_log",
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

(node as any).hash = "347b71e0f2228292b2508caeed7df559";

export default node;
