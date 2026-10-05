/**
 * @generated SignedSource<<8efe47dfa732bfe18c531ec057b4609b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareLogResultPanel_execution$data = {
  readonly error: string | null | undefined;
  readonly stderr: string | null | undefined;
  readonly stdout: string | null | undefined;
  readonly " $fragmentType": "softwareLogResultPanel_execution";
};
export type softwareLogResultPanel_execution$key = {
  readonly " $data"?: softwareLogResultPanel_execution$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogResultPanel_execution">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareLogResultPanel_execution",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "stdout",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "stderr",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "error",
      "storageKey": null
    }
  ],
  "type": "ScriptExecution",
  "abstractKey": null
};

(node as any).hash = "50b3b8b750277f2e36b81c64edb3bb73";

export default node;
