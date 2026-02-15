import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useCascadeStore } from '../stores/cascade.store';
import type { SSECascadeProgressEvent, SSECascadeCompleteEvent, SSECascadeErrorEvent } from '@wakehub/shared';

const SSE_URL = '/api/events';

export function useSSE() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(SSE_URL, { withCredentials: true });
    esRef.current = es;
    const timers: ReturnType<typeof setTimeout>[] = [];

    es.onerror = () => {
      // EventSource reconnects automatically; invalidate to re-sync state
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    };

    es.addEventListener('status-change', () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    });

    es.addEventListener('cascade-progress', (event: MessageEvent) => {
      queryClient.invalidateQueries({ queryKey: ['cascades'] });
      let data: SSECascadeProgressEvent;
      try { data = JSON.parse(event.data); } catch { return; }
      useCascadeStore.getState().updateProgress(data.nodeId, {
        cascadeId: data.cascadeId,
        step: data.step,
        totalSteps: data.totalSteps,
        currentNodeId: data.currentNodeId,
        currentNodeName: data.currentNodeName,
      });
    });

    es.addEventListener('cascade-complete', (event: MessageEvent) => {
      queryClient.invalidateQueries({ queryKey: ['cascades'] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      let data: SSECascadeCompleteEvent;
      try { data = JSON.parse(event.data); } catch { return; }
      useCascadeStore.getState().completeCascade(data.nodeId);

      // Lookup node name from TanStack Query cache
      const nodesCache = queryClient.getQueryData<{ data?: { nodes?: Array<{ id: string; name: string }> } }>(['nodes']);
      const nodeName = nodesCache?.data?.nodes?.find((n) => n.id === data.nodeId)?.name ?? data.nodeId;

      notifications.show({
        title: 'Cascade terminée',
        message: `✓ ${nodeName} démarré avec succès`,
        color: 'green',
        autoClose: 5000,
      });

      timers.push(setTimeout(() => useCascadeStore.getState().clearCascade(data.nodeId), 2000));
    });

    es.addEventListener('cascade-error', (event: MessageEvent) => {
      queryClient.invalidateQueries({ queryKey: ['cascades'] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      let data: SSECascadeErrorEvent;
      try { data = JSON.parse(event.data); } catch { return; }
      const store = useCascadeStore.getState();
      const current = store.cascades[data.nodeId];
      store.failCascade(data.nodeId, current?.currentNodeName);

      notifications.show({
        title: 'Échec de cascade',
        message: `✗ Échec : ${data.error?.message || 'Erreur inconnue'}`,
        color: 'red',
        autoClose: 5000,
      });

      timers.push(setTimeout(() => useCascadeStore.getState().clearCascade(data.nodeId), 2000));
    });

    return () => {
      es.close();
      esRef.current = null;
      timers.forEach(clearTimeout);
    };
  }, [queryClient]);
}
