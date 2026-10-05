/**
 * @generated SignedSource<<1de7d00490dc72a6610ab67967a56197>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type actionDetailLogs_action$data = {
  readonly action: SoftwareAction;
  readonly engine: PackageManagerType;
  readonly executionId: string;
  readonly software: string;
  readonly " $fragmentType": "actionDetailLogs_action";
};
export type actionDetailLogs_action$key = {
  readonly " $data"?: actionDetailLogs_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"actionDetailLogs_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "actionDetailLogs_action",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "executionId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "software",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "engine",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "action",
      "storageKey": null
    }
  ],
  "type": "SoftwareActionRun",
  "abstractKey": null
};

(node as any).hash = "700500d69e84c129131474e282cf749b";

export default node;
