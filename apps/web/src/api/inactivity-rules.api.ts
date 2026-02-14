import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiError,
  InactivityRuleListResponse,
  InactivityRuleResponse,
  CreateInactivityRuleRequest,
  UpdateInactivityRuleRequest,
} from '@wakehub/shared';
import { apiFetch } from './api-fetch';

const API_BASE = '/api/inactivity-rules';

interface RulesApiListResponse {
  data: InactivityRuleListResponse;
}

interface RuleApiResponse {
  data: InactivityRuleResponse;
}

export function useInactivityRules(nodeId: string) {
  return useQuery<RulesApiListResponse, ApiError>({
    queryKey: ['inactivity-rules', nodeId],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}?nodeId=${encodeURIComponent(nodeId)}`);
      const json = await response.json();
      if (!response.ok) {
        throw json as ApiError;
      }
      return json as RulesApiListResponse;
    },
    enabled: !!nodeId,
  });
}

export function useCreateInactivityRule() {
  const queryClient = useQueryClient();

  return useMutation<RuleApiResponse, ApiError, CreateInactivityRuleRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ApiError;
      }
      return json as RuleApiResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inactivity-rules', variables.nodeId] });
    },
  });
}

export function useUpdateInactivityRule() {
  const queryClient = useQueryClient();

  return useMutation<RuleApiResponse, ApiError, { ruleId: string; nodeId: string; data: UpdateInactivityRuleRequest }>({
    mutationFn: async ({ ruleId, data }) => {
      const response = await apiFetch(`${API_BASE}/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ApiError;
      }
      return json as RuleApiResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inactivity-rules', variables.nodeId] });
    },
  });
}
