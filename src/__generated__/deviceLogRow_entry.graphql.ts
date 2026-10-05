/**
 * @generated SignedSource<<3df2f5b3f54ff92efc2540aa89b597a8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type deviceLogRow_entry$data = {
  readonly agentTimestamp: Instant | null | undefined;
  readonly count: Long | null | undefined;
  readonly hostname: string | null | undefined;
  readonly level: string;
  readonly message: string;
  readonly timestamp: Instant;
  readonly " $fragmentType": "deviceLogRow_entry";
};
export type deviceLogRow_entry$key = {
  readonly " $data"?: deviceLogRow_entry$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceLogRow_entry">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "deviceLogRow_entry",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timestamp",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "agentTimestamp",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "level",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "message",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hostname",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "count",
      "storageKey": null
    }
  ],
  "type": "DeviceLogEntry",
  "abstractKey": null
};

(node as any).hash = "efd6e4dbd8f404a6aa19e054edc58efb";

export default node;
