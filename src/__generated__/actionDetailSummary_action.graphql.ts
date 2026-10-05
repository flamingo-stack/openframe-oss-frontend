/**
 * @generated SignedSource<<2f8459bada5d0bed69fb00bf5ee84be2>>
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
export type actionDetailSummary_action$data = {
  readonly action: SoftwareAction;
  readonly engine: PackageManagerType;
  readonly respondedMachineCount: number;
  readonly software: string;
  readonly totalMachineCount: number;
  readonly " $fragmentType": "actionDetailSummary_action";
};
export type actionDetailSummary_action$key = {
  readonly " $data"?: actionDetailSummary_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"actionDetailSummary_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "actionDetailSummary_action",
  "selections": [
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "respondedMachineCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalMachineCount",
      "storageKey": null
    }
  ],
  "type": "SoftwareActionRun",
  "abstractKey": null
};

(node as any).hash = "b6b341fb1920dbfdbb2715c6b59b18a9";

export default node;
