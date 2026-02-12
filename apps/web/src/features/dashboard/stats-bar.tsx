import { SimpleGrid, Paper, Group, Text, ThemeIcon } from '@mantine/core';
import {
  IconActivity,
  IconBolt,
  IconClock,
  IconMoon,
} from '@tabler/icons-react';
import { useStats } from '../../api/cascades.api';

interface StatTileProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}

function StatTile({ icon, value, label, color }: StatTileProps) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Group>
        <ThemeIcon size="lg" radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <div>
          <Text size="xl" fw={700} lh={1}>
            {value}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {label}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds === 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function StatsBar() {
  const { data } = useStats();
  const stats = data?.data;

  return (
    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="lg">
      <StatTile
        icon={<IconActivity size={20} />}
        value={stats?.activeServices ?? 0}
        label="Services actifs"
        color="green"
      />
      <StatTile
        icon={<IconBolt size={20} />}
        value={stats?.cascadesToday ?? 0}
        label="Cascades aujourd'hui"
        color="blue"
      />
      <StatTile
        icon={<IconClock size={20} />}
        value={formatSeconds(stats?.avgCascadeTime ?? 0)}
        label="Temps moyen"
        color="yellow"
      />
      <StatTile
        icon={<IconMoon size={20} />}
        value={stats?.inactivityHours ?? 0}
        label="Heures d'inactivité"
        color="gray"
      />
    </SimpleGrid>
  );
}
