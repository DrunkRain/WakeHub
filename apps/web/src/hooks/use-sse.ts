import { createElement, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { getAuthToken } from '../api/auth-token';
import type { CascadeProgressData } from '../api/cascades.api';
import type {
  CascadeProgressEvent,
  CascadeCompleteEvent,
  CascadeErrorEvent,
  CascadeRecord,
  Service,
} from '@wakehub/shared';

/**
 * Establishes an SSE connection to /api/events and invalidates
 * relevant TanStack Query caches when server-sent events arrive.
 * Also parses cascade events to store real-time progress data
 * and show toast notifications.
 *
 * Must be called once inside an authenticated context.
 */
export function useSSE() {
  const queryClient = useQueryClient();
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const token = getAuthToken();
    const url = token
      ? `/api/events?token=${encodeURIComponent(token)}`
      : '/api/events';
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener('status-change', () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    es.addEventListener('cascade-progress', (event: MessageEvent) => {
      queryClient.invalidateQueries({ queryKey: ['cascade'] });

      try {
        const data = JSON.parse(event.data) as CascadeProgressEvent;
        const progressData: CascadeProgressData = {
          cascadeId: data.cascadeId,
          serviceId: data.serviceId,
          step: data.step,
          totalSteps: data.totalSteps,
          currentDependency: data.currentDependency,
          status: 'in_progress',
        };
        queryClient.setQueryData(
          ['cascade', 'progress', data.serviceId],
          progressData,
        );

        // Toast warning for skipped shared dependencies
        if (data.currentDependency?.status === 'skipped-shared') {
          notifications.show({
            title: `Arrêt de ${data.currentDependency.name} annulé`,
            message: 'Dépendance partagée active',
            color: 'orange',
            icon: createElement(IconAlertTriangle, { size: 16 }),
            autoClose: 5000,
          });
        }
      } catch {
        // Ignore parse errors — invalidation still works
      }
    });

    es.addEventListener('cascade-complete', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as CascadeCompleteEvent;

        // Get previous progress to know totalSteps
        const prev = queryClient.getQueryData<CascadeProgressData>(
          ['cascade', 'progress', data.serviceId],
        );
        const totalSteps = prev?.totalSteps ?? 1;

        // Store completed state for 1.5s green flash
        const completedData: CascadeProgressData = {
          cascadeId: data.cascadeId,
          serviceId: data.serviceId,
          step: totalSteps,
          totalSteps,
          currentDependency: null,
          status: 'completed',
        };
        queryClient.setQueryData(
          ['cascade', 'progress', data.serviceId],
          completedData,
        );

        // Clean up after 1.5s
        const timerId = setTimeout(() => {
          queryClient.removeQueries({
            queryKey: ['cascade', 'progress', data.serviceId],
          });
          timersRef.current.delete(timerId);
        }, 1500);
        timersRef.current.add(timerId);

        // Toast success — look up service name and cascade type from cache
        const serviceName = getServiceName(queryClient, data.serviceId);
        const cascadeType = getCascadeType(queryClient, data.cascadeId);
        const isStop = cascadeType === 'stop';
        notifications.show({
          title: isStop
            ? `${serviceName} arrêté avec succès`
            : `${serviceName} démarré avec succès`,
          message: '',
          color: 'green',
          icon: createElement(IconCheck, { size: 16 }),
          autoClose: 5000,
        });
      } catch {
        // Ignore parse errors
      }

      queryClient.invalidateQueries({ queryKey: ['cascade'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    es.addEventListener('cascade-error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as CascadeErrorEvent;

        // Get previous progress to preserve step info
        const prev = queryClient.getQueryData<CascadeProgressData>(
          ['cascade', 'progress', data.serviceId],
        );

        const failedData: CascadeProgressData = {
          cascadeId: data.cascadeId,
          serviceId: data.serviceId,
          step: data.failedStep,
          totalSteps: prev?.totalSteps ?? 1,
          currentDependency: prev?.currentDependency ?? null,
          status: 'failed',
        };
        queryClient.setQueryData(
          ['cascade', 'progress', data.serviceId],
          failedData,
        );

        // Toast error — detect stop vs start
        const errorCascadeType = getCascadeType(queryClient, data.cascadeId);
        const isStopError = errorCascadeType === 'stop';
        notifications.show({
          title: isStopError ? "Échec de l'arrêt" : 'Échec du démarrage',
          message: data.error.message,
          color: 'red',
          icon: createElement(IconX, { size: 16 }),
          autoClose: 5000,
        });
      } catch {
        // Ignore parse errors
      }

      queryClient.invalidateQueries({ queryKey: ['cascade'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    return () => {
      es.close();
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, [queryClient]);
}

/** Look up a service name from the TanStack Query cache */
function getServiceName(
  queryClient: ReturnType<typeof useQueryClient>,
  serviceId: string,
): string {
  const servicesData = queryClient.getQueryData<{ data: Service[] }>(['services']);
  const service = servicesData?.data?.find((s) => s.id === serviceId);
  return service?.name ?? 'Service';
}

/** Look up the cascade type (start/stop) from the TanStack Query cache */
function getCascadeType(
  queryClient: ReturnType<typeof useQueryClient>,
  cascadeId: string,
): string | undefined {
  const cascadesData = queryClient.getQueryData<{ data: CascadeRecord[] }>(['cascade', 'active']);
  const cascade = cascadesData?.data?.find((c) => c.id === cascadeId);
  return cascade?.type;
}
