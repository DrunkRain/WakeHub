import {
  Card,
  Badge,
  Button,
  Group,
  Text,
  Stack,
  ActionIcon,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconExternalLink,
  IconRefresh,
  IconPinnedOff,
} from '@tabler/icons-react';
import type { Service, CascadeRecord } from '@wakehub/shared';
import { useCascadeProgress } from '../../api/cascades.api';
import { CascadeProgress } from './cascade-progress';
import classes from './service-tile.module.css';

export type VisualStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

export interface ServiceTileProps {
  service: Service;
  activeCascade?: CascadeRecord | null;
  dependencySummary?: string;
  onStart?: (serviceId: string) => void;
  isStarting?: boolean;
  onUnpin?: (id: string) => void;
  onTileClick?: (serviceId: string) => void;
}

export const statusConfig: Record<VisualStatus, { label: string; color: string }> = {
  running: { label: 'Actif', color: 'green' },
  stopped: { label: 'Éteint', color: 'gray' },
  starting: { label: 'En démarrage', color: 'yellow' },
  stopping: { label: 'En arrêt', color: 'orange' },
  error: { label: 'Erreur', color: 'red' },
};

const typeLabel: Record<string, string> = {
  physical: 'Physique',
  proxmox: 'Proxmox',
  docker: 'Docker',
  vm: 'VM',
  container: 'Conteneur',
};

export function deriveVisualStatus(
  service: Service,
  activeCascade?: CascadeRecord | null,
): VisualStatus {
  if (activeCascade) {
    const isActive =
      activeCascade.status === 'pending' || activeCascade.status === 'in_progress';
    if (isActive && activeCascade.type === 'start') return 'starting';
    if (isActive && activeCascade.type === 'stop') return 'stopping';
    if (activeCascade.status === 'failed') return 'error';
  }
  if (service.status === 'running' || service.status === 'online') return 'running';
  if (service.status === 'stopped' || service.status === 'paused' || service.status === 'offline') return 'stopped';
  if (service.status === 'error') return 'error';
  return 'stopped';
}

export function ServiceTile({
  service,
  activeCascade,
  dependencySummary,
  onStart,
  isStarting,
  onUnpin,
  onTileClick,
}: ServiceTileProps) {
  const hasCascadeSupport = !!onStart;
  const visualStatus = deriveVisualStatus(service, activeCascade);
  const config = statusConfig[visualStatus];
  const { data: progressData } = useCascadeProgress(service.id);

  const isLoading = isStarting || visualStatus === 'starting' || visualStatus === 'stopping';

  // Show CascadeProgress when cascade is active, recently completed, or failed
  const cascadeStatus = progressData?.status;
  const showProgress =
    hasCascadeSupport && (
      visualStatus === 'starting' ||
      visualStatus === 'stopping' ||
      cascadeStatus === 'completed' ||
      cascadeStatus === 'failed'
    );

  const progressBarStatus: 'in_progress' | 'completed' | 'failed' =
    cascadeStatus === 'completed' ? 'completed' :
    cascadeStatus === 'failed' ? 'failed' : 'in_progress';

  const ariaLabel = `Service ${service.name} — ${config.label}`;

  return (
    <Card
      role="article"
      aria-label={ariaLabel}
      padding="lg"
      radius="md"
      withBorder
      className={`${classes.tile}${onTileClick ? ` ${classes.clickable}` : ''}`}
      onClick={onTileClick ? () => onTileClick(service.id) : undefined}
      style={onTileClick ? { cursor: 'pointer' } : undefined}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="lg" fw={600} component="h3" lh={1.2}>
              {service.name}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {typeLabel[service.type] ?? service.type}
            </Text>
          </div>
          <Group gap={4}>
            <Badge color={config.color} variant="light" size="sm">
              {config.label}
            </Badge>
            {onUnpin && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onUnpin(service.id); }}
                aria-label={`Désépingler ${service.name}`}
              >
                <IconPinnedOff size={14} />
              </ActionIcon>
            )}
          </Group>
        </Group>

        {dependencySummary && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {dependencySummary}
          </Text>
        )}

        {visualStatus === 'error' && activeCascade?.errorMessage && (
          <Text size="xs" c="red">
            Échec : {activeCascade.errorMessage}
          </Text>
        )}

        {showProgress && (
          <CascadeProgress
            currentStep={progressData?.step ?? activeCascade?.currentStep ?? 0}
            totalSteps={progressData?.totalSteps ?? activeCascade?.totalSteps ?? 1}
            currentDependencyName={progressData?.currentDependency?.name}
            status={progressBarStatus}
          />
        )}

        {visualStatus === 'stopped' && onStart && (
          <Button
            size="sm"
            color="blue"
            leftSection={<IconPlayerPlay size={16} />}
            loading={isLoading}
            onClick={(e) => { e.stopPropagation(); onStart(service.id); }}
            aria-label={`Démarrer ${service.name}`}
          >
            Démarrer
          </Button>
        )}

        {visualStatus === 'running' && service.serviceUrl && (
          <Button
            size="sm"
            color="blue"
            variant="light"
            leftSection={<IconExternalLink size={16} />}
            component="a"
            href={service.serviceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ouvrir ${service.name}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            Ouvrir
          </Button>
        )}

        {visualStatus === 'error' && onStart && (
          <Button
            size="sm"
            color="orange"
            leftSection={<IconRefresh size={16} />}
            loading={isLoading}
            onClick={(e) => { e.stopPropagation(); onStart(service.id); }}
            aria-label={`Réessayer ${service.name}`}
          >
            Réessayer
          </Button>
        )}

        {hasCascadeSupport && (visualStatus === 'starting' || visualStatus === 'stopping') && (
          <Button
            size="sm"
            color={visualStatus === 'starting' ? 'yellow' : 'orange'}
            variant="light"
            loading
            disabled
          >
            {visualStatus === 'starting' ? 'En démarrage...' : 'En arrêt...'}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
