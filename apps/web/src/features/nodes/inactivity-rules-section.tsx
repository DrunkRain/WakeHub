import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Switch,
  NumberInput,
  Checkbox,
  Button,
  Group,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconSettings } from '@tabler/icons-react';
import type { MonitoringCriteria, NodeType } from '@wakehub/shared';
import {
  useInactivityRules,
  useCreateInactivityRule,
  useUpdateInactivityRule,
} from '../../api/inactivity-rules.api';

interface CriteriaConfig {
  label: string;
  disabled: boolean;
  disabledReason?: string;
}

type CriteriaKey = 'lastAccess' | 'networkConnections' | 'cpuRamActivity' | 'networkTraffic';

function getCriteriaConfig(nodeType: NodeType): Record<CriteriaKey, CriteriaConfig> {
  switch (nodeType) {
    case 'vm':
    case 'lxc':
      return {
        lastAccess: { label: 'Dernier accès (TCP)', disabled: false },
        networkConnections: { label: 'Connexions réseau (SSH)', disabled: true, disabledReason: 'Non disponible pour les VMs/LXCs (compteurs réseau cumulés)' },
        cpuRamActivity: { label: 'Activité CPU/RAM (Proxmox API)', disabled: false },
        networkTraffic: { label: 'Trafic réseau (Proxmox API)', disabled: false },
      };
    case 'container':
      return {
        lastAccess: { label: 'Dernier accès (CPU/RAM Docker)', disabled: false },
        networkConnections: { label: 'Connexions réseau (SSH)', disabled: true, disabledReason: 'Non disponible pour les conteneurs' },
        cpuRamActivity: { label: 'Activité CPU/RAM (Docker API)', disabled: false },
        networkTraffic: { label: 'Trafic réseau (Docker API)', disabled: false },
      };
    default: // physical
      return {
        lastAccess: { label: 'Dernier accès (TCP)', disabled: false },
        networkConnections: { label: 'Connexions réseau (SSH)', disabled: false },
        cpuRamActivity: { label: 'Activité CPU/RAM (SSH)', disabled: false },
        networkTraffic: { label: 'Trafic réseau', disabled: true, disabledReason: 'Non applicable aux machines physiques' },
      };
  }
}

interface InactivityRulesSectionProps {
  nodeId: string;
  nodeType: NodeType;
}

export function InactivityRulesSection({ nodeId, nodeType }: InactivityRulesSectionProps) {
  const { data, isLoading, error } = useInactivityRules(nodeId);
  const createRule = useCreateInactivityRule();
  const updateRule = useUpdateInactivityRule();

  const rules = data?.data.rules ?? [];
  const rule = rules[0] ?? null;

  const [isEnabled, setIsEnabled] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);
  const [criteria, setCriteria] = useState<MonitoringCriteria>({
    lastAccess: true,
    networkConnections: false,
    cpuRamActivity: false,
    networkTraffic: false,
  });

  // Sync form state only when a different rule loads (not on background refetches)
  const ruleId = rule?.id;
  useEffect(() => {
    if (rule) {
      setIsEnabled(rule.isEnabled);
      setTimeoutMinutes(rule.timeoutMinutes);
      // Force disabled criteria to false so visual state matches persisted state
      const config = getCriteriaConfig(nodeType);
      const cleaned = { ...rule.monitoringCriteria };
      for (const key of ['lastAccess', 'networkConnections', 'cpuRamActivity', 'networkTraffic'] as const) {
        if (config[key].disabled) cleaned[key] = false;
      }
      setCriteria(cleaned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleId]);

  const handleCreate = () => {
    createRule.mutate(
      { nodeId },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Règle créée',
            message: 'La surveillance a été configurée avec les valeurs par défaut',
            color: 'green',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Erreur',
            message: err.error?.message ?? 'Impossible de créer la règle',
            color: 'red',
          });
        },
      },
    );
  };

  const handleSave = () => {
    if (!rule) return;
    updateRule.mutate(
      {
        ruleId: rule.id,
        nodeId,
        data: {
          isEnabled,
          timeoutMinutes,
          monitoringCriteria: criteria,
        },
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Règle mise à jour',
            message: 'Les modifications ont été enregistrées',
            color: 'green',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Erreur',
            message: err.error?.message ?? 'Impossible de mettre à jour la règle',
            color: 'red',
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Règles d'inactivité</Title>
          <Center py="sm">
            <Loader size="sm" />
          </Center>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Règles d'inactivité</Title>
          <Text size="sm" c="red">
            {error.error?.message ?? 'Erreur lors du chargement des règles.'}
          </Text>
        </Stack>
      </Card>
    );
  }

  // State 1: No rule exists
  if (!rule) {
    return (
      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Règles d'inactivité</Title>
          <Text size="sm" c="dimmed">Aucune règle configurée.</Text>
          <Button
            leftSection={<IconSettings size={16} />}
            variant="light"
            onClick={handleCreate}
            loading={createRule.isPending}
          >
            Configurer la surveillance
          </Button>
        </Stack>
      </Card>
    );
  }

  const criteriaConfig = getCriteriaConfig(nodeType);

  function renderCriteriaCheckbox(key: CriteriaKey, checked: boolean, onChange: (checked: boolean) => void) {
    const config = criteriaConfig[key];
    const checkbox = (
      <Checkbox
        label={config.label}
        checked={config.disabled ? false : checked}
        disabled={config.disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    );
    if (config.disabled && config.disabledReason) {
      return (
        <Tooltip label={config.disabledReason} withArrow>
          <div>{checkbox}</div>
        </Tooltip>
      );
    }
    return checkbox;
  }

  // State 2: Rule exists
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>Règles d'inactivité</Title>

        <Switch
          label="Surveillance active"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.currentTarget.checked)}
        />

        <NumberInput
          label="Délai d'inactivité (minutes)"
          value={timeoutMinutes}
          onChange={(val) => { if (typeof val === 'number') setTimeoutMinutes(val); }}
          min={1}
        />

        <Text size="sm" fw={500}>Critères de surveillance</Text>
        {renderCriteriaCheckbox('lastAccess', criteria.lastAccess, (v) => setCriteria({ ...criteria, lastAccess: v }))}
        {renderCriteriaCheckbox('networkConnections', criteria.networkConnections, (v) => setCriteria({ ...criteria, networkConnections: v }))}
        {renderCriteriaCheckbox('cpuRamActivity', criteria.cpuRamActivity, (v) => setCriteria({
          ...criteria,
          cpuRamActivity: v,
          ...(v && criteria.cpuThreshold === undefined ? { cpuThreshold: 0.5, ramThreshold: 0.5 } : {}),
        }))}
        {renderCriteriaCheckbox('networkTraffic', criteria.networkTraffic ?? false, (v) => setCriteria({
          ...criteria,
          networkTraffic: v,
          ...(v && criteria.networkTrafficThreshold === undefined ? { networkTrafficThreshold: 1024 } : {}),
        }))}

        {criteria.cpuRamActivity && (
          <Group grow>
            <NumberInput
              label="Seuil CPU (%)"
              value={Math.round((criteria.cpuThreshold ?? 0.5) * 100)}
              onChange={(val) => {
                if (typeof val === 'number') setCriteria({ ...criteria, cpuThreshold: val / 100 });
              }}
              min={1}
              max={100}
            />
            <NumberInput
              label="Seuil RAM (%)"
              value={Math.round((criteria.ramThreshold ?? 0.5) * 100)}
              onChange={(val) => {
                if (typeof val === 'number') setCriteria({ ...criteria, ramThreshold: val / 100 });
              }}
              min={1}
              max={100}
            />
          </Group>
        )}

        {criteria.networkTraffic && (
          <NumberInput
            label="Seuil trafic réseau (bytes)"
            description="Delta minimum de bytes (rx+tx) entre deux ticks pour considérer le noeud actif"
            value={criteria.networkTrafficThreshold ?? 1024}
            onChange={(val) => {
              if (typeof val === 'number') setCriteria({ ...criteria, networkTrafficThreshold: val });
            }}
            min={0}
          />
        )}

        <Group>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={updateRule.isPending}
          >
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
