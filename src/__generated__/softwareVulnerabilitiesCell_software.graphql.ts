/**
 * @generated SignedSource<<d980098b4f95ab43cce51eddc48ee135>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareVulnerabilitiesCell_software$data = {
  readonly cpeMatched: boolean | null | undefined;
  readonly vulnerabilitySummary: {
    readonly cveCount: number;
  } | null | undefined;
  readonly " $fragmentType": "softwareVulnerabilitiesCell_software";
};
export type softwareVulnerabilitiesCell_software$key = {
  readonly " $data"?: softwareVulnerabilitiesCell_software$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareVulnerabilitiesCell_software">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareVulnerabilitiesCell_software",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cpeMatched",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SoftwareVulnerabilitySummary",
      "kind": "LinkedField",
      "name": "vulnerabilitySummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cveCount",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Software",
  "abstractKey": null
};

(node as any).hash = "521dadd6c68e6e123c3ba3f5d2b8a182";

export default node;
