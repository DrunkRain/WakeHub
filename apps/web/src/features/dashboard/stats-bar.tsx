import { SimpleGrid, Paper, Text, Skeleton } from '@mantine/core';
import { useStats } from '../../api/stats.api';

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m${remainder > 0 ? ` ${remainder}s` : ''}`;
}

export function StatsBar() {
  const { data, isLoading } = useStats();
  const stats = data?.data;

  if (isLoading) {
    return (
      <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <Paper key={i} p="md" withBorder>
            <Skeleton height={16} width="60%" mb="xs" />
            <Skeleton height={28} width="40%" />
          </Paper>
        ))}
      </SimpleGrid>
    );
  }

  const tiles = [
    { label: 'Noeuds actifs', value: stats ? `${stats.nodesOnline}/${stats.nodesTotal}` : '—' },
    { label: 'Cascades du jour', value: stats ? String(stats.cascadesToday) : '—' },
    { label: 'Temps moyen cascade', value: stats ? formatDuration(stats.avgCascadeDurationMs) : '—' },
    { label: "Heures d'inactivité", value: '—' },
  ];

  return (
    <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg">
      {tiles.map((tile) => (
        <Paper key={tile.label} p="md" withBorder>
          <Text size="sm" c="dimmed">{tile.label}</Text>
          <Text size="xl" fw={700}>{tile.value}</Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
