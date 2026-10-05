/**
 * @generated SignedSource<<b41f3c6484a4c1413edb1fb0996a454d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type RemoteSessionRecordingState = "NONE" | "PROCESSING" | "READY" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type sessionRecordingsApiService_session$data = {
  readonly deviceId: string;
  readonly dialogId: string | null | undefined;
  readonly durationMs: Long | null | undefined;
  readonly organization: {
    readonly logoUrl: string | null | undefined;
    readonly name: string;
    readonly organizationId: string | null | undefined;
  } | null | undefined;
  readonly recordingState: RemoteSessionRecordingState;
  readonly recordings: ReadonlyArray<{
    readonly downloadUrl: string | null | undefined;
    readonly protocol: number;
    readonly recordingId: string;
    readonly sizeBytes: Long | null | undefined;
  }>;
  readonly sessionId: string;
  readonly startedAt: Instant;
  readonly technician: {
    readonly avatarUrl: string | null | undefined;
    readonly name: string;
  };
  readonly " $fragmentType": "sessionRecordingsApiService_session";
};
export type sessionRecordingsApiService_session$key = {
  readonly " $data"?: sessionRecordingsApiService_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"sessionRecordingsApiService_session">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "sessionRecordingsApiService_session"
};

(node as any).hash = "20821a0ae9189687a8a51c1ff6f090eb";

export default node;
