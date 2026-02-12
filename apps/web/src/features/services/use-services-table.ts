import { useMemo, useState, useCallback } from 'react';
import {
  IconServer,
  IconBox,
  IconBrandDocker,
  IconDeviceDesktop,
  IconPackage,
  type TablerIcon,
} from '@tabler/icons-react';
import type { Service, ServiceType, ServiceStatus } from '@wakehub/shared';

// --- Constants ---

export const SERVICE_TYPE_ICON: Record<ServiceType, TablerIcon> = {
  physical: IconServer,
  proxmox: IconBox,
  docker: IconBrandDocker,
  vm: IconDeviceDesktop,
  container: IconPackage,
};

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  physical: 'Physique',
  proxmox: 'Proxmox',
  docker: 'Docker',
  vm: 'VM',
  container: 'Conteneur',
};

export const STATUS_COLORS: Record<ServiceStatus, string> = {
  online: 'green',
  offline: 'red',
  running: 'green',
  stopped: 'gray',
  paused: 'yellow',
  unknown: 'gray',
  error: 'orange',
};

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  online: 'En ligne',
  offline: 'Hors ligne',
  running: 'En cours',
  stopped: 'Arrêté',
  paused: 'En pause',
  unknown: 'Inconnu',
  error: 'Erreur',
};

// --- Utility ---

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function formatRelativeTime(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);

  if (diff < 0) return 'à l\u2019instant';
  if (diff < MINUTE) return 'à l\u2019instant';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `il y a ${m} min`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `il y a ${h} h`;
  }
  const d = Math.floor(diff / DAY);
  return `il y a ${d} j`;
}

// --- Hook ---

export type SortField = 'name' | 'type' | 'status' | 'ipAddress' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

interface UseServicesTableReturn {
  sortField: SortField;
  sortDirection: SortDirection;
  toggleSort: (field: SortField) => void;
  statusFilters: ServiceStatus[];
  setStatusFilters: (values: ServiceStatus[]) => void;
  typeFilters: ServiceType[];
  setTypeFilters: (values: ServiceType[]) => void;
  filteredServices: Service[];
  hasActiveFilters: boolean;
}

export function useServicesTable(services: Service[]): UseServicesTableReturn {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilters, setStatusFilters] = useState<ServiceStatus[]>([]);
  const [typeFilters, setTypeFilters] = useState<ServiceType[]>([]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  const hasActiveFilters = statusFilters.length > 0 || typeFilters.length > 0;

  const filteredServices = useMemo(() => {
    let result = services;

    if (statusFilters.length > 0) {
      result = result.filter((s) => statusFilters.includes(s.status));
    }
    if (typeFilters.length > 0) {
      result = result.filter((s) => typeFilters.includes(s.type));
    }

    result = [...result].sort((a, b) => {
      let cmp: number;
      if (sortField === 'updatedAt') {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortField === 'ipAddress') {
        cmp = (a.ipAddress ?? '').localeCompare(b.ipAddress ?? '');
      } else {
        cmp = a[sortField].localeCompare(b[sortField]);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [services, statusFilters, typeFilters, sortField, sortDirection]);

  return {
    sortField,
    sortDirection,
    toggleSort,
    statusFilters,
    setStatusFilters,
    typeFilters,
    setTypeFilters,
    filteredServices,
    hasActiveFilters,
  };
}
