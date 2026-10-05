/**
 * @generated SignedSource<<ab0ae2cefa211c8a6f3101b866136422>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DirectoryConsentIssueKind = "PERMISSIONS_PENDING" | "PROVIDER_ERROR" | "%future added value";
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type tenantConsentIssues_connection$data = {
  readonly domain: string | null | undefined;
  readonly lastConsentInfo: {
    readonly issues: ReadonlyArray<{
      readonly correlationId: string | null | undefined;
      readonly kind: DirectoryConsentIssueKind;
      readonly message: string;
      readonly providerCode: string | null | undefined;
      readonly tier: string | null | undefined;
    }>;
    readonly occurredAt: Instant;
  } | null | undefined;
  readonly provider: DirectoryProvider;
  readonly " $fragmentType": "tenantConsentIssues_connection";
};
export type tenantConsentIssues_connection$key = {
  readonly " $data"?: tenantConsentIssues_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantConsentIssues_connection">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantConsentIssues_connection",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "provider",
      "storageKey": null
    },
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
      "concreteType": "DirectoryConsentInfo",
      "kind": "LinkedField",
      "name": "lastConsentInfo",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "occurredAt",
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
              "name": "tier",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "kind",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "providerCode",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "correlationId",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "message",
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

(node as any).hash = "bb0fa02d428ffdcae44ad3eb848bbe6f";

export default node;
