/**
 * @generated SignedSource<<f90ec21d50a0e1f886893ab6e542d5df>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DirectoryAccessState = "CONSENT_REVOKED" | "DISCONNECTED" | "NOT_AUTHORISED" | "READ_ONLY" | "WRITE_AVAILABLE" | "WRITE_ENABLED" | "%future added value";
export type DirectoryConsentOutcome = "CONNECTED" | "DENIED" | "ERROR" | "EXPIRED" | "NOT_ADMIN" | "NOT_CONSENTED" | "PARTIAL" | "SIGN_IN_FAILED" | "WRONG_DOMAIN" | "WRONG_TENANT" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type tenantConsentAlert_connection$data = {
  readonly access: {
    readonly state: DirectoryAccessState;
  };
  readonly domain: string | null | undefined;
  readonly lastConsentInfo: {
    readonly deniedTiers: ReadonlyArray<string>;
    readonly issues: ReadonlyArray<{
      readonly __typename: "DirectoryConsentIssue";
    }>;
    readonly outcome: DirectoryConsentOutcome;
  } | null | undefined;
  readonly " $fragmentType": "tenantConsentAlert_connection";
};
export type tenantConsentAlert_connection$key = {
  readonly " $data"?: tenantConsentAlert_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantConsentAlert_connection">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantConsentAlert_connection",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "domain",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DirectoryConnectionAccess",
      "kind": "LinkedField",
      "name": "access",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "state",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DirectoryConsentInfo",
      "kind": "LinkedField",
      "name": "lastConsentInfo",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "outcome",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "deniedTiers",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "DirectoryConsentIssue",
          "kind": "LinkedField",
          "name": "issues",
          "plural": true,
          "selections": [
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
    }
  ],
  "type": "DirectoryConnection",
  "abstractKey": null
};

(node as any).hash = "84c6a4302e72f3f6729d878302edf999";

export default node;
