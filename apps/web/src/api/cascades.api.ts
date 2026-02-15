import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiFetch } from './api-fetch';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface StartCascadeResponse {
  data: {
    cascade: {
      id: string;
      nodeId: string;
      type: string;
      status: string;
    };
  };
}

export function useStartCascade() {
  const queryClient = useQueryClient();

  return useMutation<StartCascadeResponse, ErrorResponse, string>({
    mutationFn: async (nodeId) => {
      const response = await apiFetch('/api/cascades/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as StartCascadeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
    onError: (error: ErrorResponse) => {
      notifications.show({
        title: 'Erreur de démarrage',
        message: error.error?.message ?? 'Impossible de lancer la cascade',
        color: 'red',
      });
    },
  });
}

interface StopCascadeResponse {
  data: {
    cascade: {
      id: string;
      nodeId: string;
      type: string;
      status: string;
    };
  };
}

export function useStopCascade() {
  const queryClient = useQueryClient();

  return useMutation<StopCascadeResponse, ErrorResponse, string>({
    mutationFn: async (nodeId) => {
      const response = await apiFetch('/api/cascades/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as StopCascadeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
    onError: (error: ErrorResponse) => {
      notifications.show({
        title: "Erreur d'arrêt",
        message: error.error?.message ?? "Impossible de lancer la cascade d'arrêt",
        color: 'red',
      });
    },
  });
}
