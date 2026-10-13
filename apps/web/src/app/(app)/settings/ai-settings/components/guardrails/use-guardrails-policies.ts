'use client';

import type { ApprovalLevel } from '@flamingo-stack/openframe-frontend-core';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  type GraphqlResponse,
  type MutationPayloadGql,
  queryDataOrThrow,
  throwOnErrors,
} from '../../hooks/chat-graphql';
import {
  CUSTOM_POLICY_TYPE,
  type CustomPolicyRequest,
  type PolicyTemplateDetail,
  type PolicyTemplateSummary,
} from './guardrails.types';
import {
  GUARDRAIL_RULE_FIELDS,
  type GuardrailRuleGql,
  organizationGuardrailsQueryKeys,
  toPolicyRule,
} from './use-organization-guardrails';

/**
 * React-query data layer for guardrails policy templates (ai-agent GraphQL
 * `guardrailPolicies`, tenant-scoped). A future per-organization scope
 * (customer details page) extends these hooks and their query keys — the
 * editor and panel components stay unchanged.
 *
 * Every view-model `id` is the raw `policyId`, not the Relay `GuardrailPolicy.id`:
 * it is compared with `OrganizationGuardrails.sourceTemplate`, which is raw.
 * The mutations accept both.
 */

const GET_GUARDRAIL_POLICIES_QUERY = `
  query GuardrailPolicies {
    guardrailPolicies {
      policyId
      displayName
      description
      type
      isActive
      customOverridesCount
    }
  }
`;

const GET_GUARDRAIL_POLICY_QUERY = `
  query GuardrailPolicy($id: ID!) {
    guardrailPolicy(id: $id) {
      policyId
      displayName
      type
      isActive
      sourceTemplate
      rules {
        ${GUARDRAIL_RULE_FIELDS}
      }
      customOverrides {
        naturalKey
        approvalLevel
      }
    }
  }
`;

const ACTIVATE_GUARDRAIL_POLICY_MUTATION = `
  mutation ActivateGuardrailPolicy($input: GuardrailPolicyIdInput!) {
    activateGuardrailPolicy(input: $input) {
      userErrors { field message }
    }
  }
`;

const SAVE_CUSTOM_GUARDRAIL_POLICY_MUTATION = `
  mutation SaveCustomGuardrailPolicy($input: SaveCustomGuardrailPolicyInput!) {
    saveCustomGuardrailPolicy(input: $input) {
      userErrors { field message }
    }
  }
`;

interface GuardrailPolicySummaryGql {
  policyId: string;
  displayName: string | null;
  description: string | null;
  type: PolicyTemplateSummary['type'];
  isActive: boolean;
  customOverridesCount: number;
}

interface GuardrailPolicyDetailGql {
  policyId: string;
  displayName: string | null;
  type: PolicyTemplateDetail['type'];
  isActive: boolean;
  sourceTemplate: string | null;
  rules: GuardrailRuleGql[];
  customOverrides: { naturalKey: string; approvalLevel: ApprovalLevel }[];
}

export const guardrailsQueryKeys = {
  all: ['guardrails-policies'] as const,
  templates: () => [...guardrailsQueryKeys.all, 'templates'] as const,
  template: (id: string) => [...guardrailsQueryKeys.all, 'template', id] as const,
};

export function useGuardrailsTemplates() {
  const result = useQuery({
    queryKey: guardrailsQueryKeys.templates(),
    queryFn: async (): Promise<PolicyTemplateSummary[]> => {
      const response = await apiClient.post<GraphqlResponse<{ guardrailPolicies: GuardrailPolicySummaryGql[] }>>(
        '/chat/graphql',
        { query: GET_GUARDRAIL_POLICIES_QUERY },
      );
      const { guardrailPolicies } = queryDataOrThrow(response, 'Failed to fetch policy templates');
      const templates: PolicyTemplateSummary[] = guardrailPolicies.map(policy => ({
        id: policy.policyId,
        displayName: policy.displayName ?? '',
        description: policy.description ?? undefined,
        type: policy.type,
        isActive: policy.isActive,
        customOverridesCount: policy.customOverridesCount,
      }));
      // Stock templates first, the tenant's custom policy last.
      return templates.sort((a, b) => {
        if (a.type === CUSTOM_POLICY_TYPE && b.type !== CUSTOM_POLICY_TYPE) return 1;
        if (a.type !== CUSTOM_POLICY_TYPE && b.type === CUSTOM_POLICY_TYPE) return -1;
        return 0;
      });
    },
  });

  const templates = useMemo(() => result.data ?? [], [result.data]);
  const activeTemplateId = useMemo(() => templates.find(t => t.isActive)?.id ?? null, [templates]);
  const customTemplate = useMemo(() => templates.find(t => t.type === CUSTOM_POLICY_TYPE) ?? null, [templates]);

  return {
    templates,
    activeTemplateId,
    customTemplate,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useGuardrailsTemplate(templateId: string | null) {
  const result = useQuery({
    queryKey: guardrailsQueryKeys.template(templateId ?? ''),
    queryFn: async (): Promise<PolicyTemplateDetail> => {
      const response = await apiClient.post<GraphqlResponse<{ guardrailPolicy: GuardrailPolicyDetailGql | null }>>(
        '/chat/graphql',
        { query: GET_GUARDRAIL_POLICY_QUERY, variables: { id: templateId } },
      );
      const { guardrailPolicy: policy } = queryDataOrThrow(response, 'Failed to fetch policy template');
      if (!policy) throw new Error('Policy template not found');
      return {
        id: policy.policyId,
        displayName: policy.displayName ?? '',
        type: policy.type,
        sourceTemplate: policy.sourceTemplate ?? undefined,
        rules: policy.rules.map(toPolicyRule),
        customOverrides: Object.fromEntries(
          policy.customOverrides.map(override => [override.naturalKey, override.approvalLevel]),
        ),
        active: policy.isActive,
      };
    },
    enabled: !!templateId,
  });

  return {
    template: result.data ?? null,
    isLoading: !!templateId && result.isLoading,
    error: result.error,
  };
}

export function useActivateGuardrailsTemplate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const result = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiClient.post<GraphqlResponse<Record<string, MutationPayloadGql>>>('/chat/graphql', {
        query: ACTIVATE_GUARDRAIL_POLICY_MUTATION,
        variables: { input: { id: templateId } },
      });
      throwOnErrors(response, 'Failed to activate policy template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.all });
      // Orgs on `inheritDefault` see the activated template as their EFFECTIVE
      // guardrails — drop their caches so customer pages update live.
      queryClient.invalidateQueries({ queryKey: organizationGuardrailsQueryKeys.all });
      toast({
        title: 'Guardrails Saved',
        description: 'Policy template activated successfully',
        variant: 'success',
        duration: 4000,
      });
    },
    onError: err => {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to activate policy template',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  return { activate: result.mutateAsync, isPending: result.isPending };
}

export function useSaveCustomGuardrailsPolicy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const result = useMutation({
    mutationFn: async ({ templateId, overrides }: CustomPolicyRequest) => {
      const response = await apiClient.post<GraphqlResponse<Record<string, MutationPayloadGql>>>('/chat/graphql', {
        query: SAVE_CUSTOM_GUARDRAIL_POLICY_MUTATION,
        variables: {
          input: {
            templateId,
            overrides: Object.entries(overrides).map(([naturalKey, approvalLevel]) => ({ naturalKey, approvalLevel })),
          },
        },
      });
      throwOnErrors(response, 'Failed to save custom policy');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.all });
      // Same as activation: a changed custom policy may be the active tenant
      // default that inheriting orgs resolve to.
      queryClient.invalidateQueries({ queryKey: organizationGuardrailsQueryKeys.all });
      toast({
        title: 'Custom Policy Saved',
        description: 'Your custom policy has been saved successfully',
        variant: 'success',
        duration: 4000,
      });
    },
    onError: err => {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save custom policy',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  return { saveCustomPolicy: result.mutateAsync, isPending: result.isPending };
}
