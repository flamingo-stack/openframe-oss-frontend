/**
 * The guardrail review of a tool call (ai-agent `PolicyReview`), for every `/chat/graphql` selection of
 * `PendingToolCall` and `ExecutingToolData`. `PolicyReviewRule.type` stays out: the ai-agent is removing it, and a
 * field the schema no longer has fails the whole query.
 */
export const POLICY_REVIEW_SELECTION = `policyReview {
  decision
  approvalLevel
  policyLevel
  operationCodes
  matchedRules {
    code
    label
  }
  reason
}`;
