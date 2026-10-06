/**
 * @generated SignedSource<<8d546bd70e1b9c9c4c14623dadc42fea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type actionDetailHeader_action$data = {
  readonly action: SoftwareAction;
  readonly " $fragmentType": "actionDetailHeader_action";
};
export type actionDetailHeader_action$key = {
  readonly " $data"?: actionDetailHeader_action$data;
  readonly " $fragmentSpreads": FragmentRefs<"actionDetailHeader_action">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "actionDetailHeader_action",
  "selections": [
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

(node as any).hash = "2af056e24321e90bd004d339b49f5f76";

export default node;
