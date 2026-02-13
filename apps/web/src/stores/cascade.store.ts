import { create } from 'zustand';

export interface CascadeNodeState {
  cascadeId: string;
  step: number;
  totalSteps: number;
  currentNodeId?: string;
  currentNodeName?: string;
  status: 'in_progress' | 'completed' | 'failed';
  errorNodeName?: string;
}

interface CascadeStore {
  cascades: Record<string, CascadeNodeState>;
  updateProgress: (nodeId: string, data: Partial<CascadeNodeState> & { cascadeId: string }) => void;
  completeCascade: (nodeId: string) => void;
  failCascade: (nodeId: string, errorNodeName?: string) => void;
  clearCascade: (nodeId: string) => void;
}

export const useCascadeStore = create<CascadeStore>((set) => ({
  cascades: {},
  updateProgress: (nodeId, data) =>
    set((state) => ({
      cascades: {
        ...state.cascades,
        [nodeId]: {
          ...state.cascades[nodeId],
          ...data,
          status: 'in_progress',
        } as CascadeNodeState,
      },
    })),
  completeCascade: (nodeId) =>
    set((state) => {
      const existing = state.cascades[nodeId];
      if (!existing) return state;
      return {
        cascades: {
          ...state.cascades,
          [nodeId]: { ...existing, status: 'completed', step: existing.totalSteps },
        },
      };
    }),
  failCascade: (nodeId, errorNodeName) =>
    set((state) => {
      const existing = state.cascades[nodeId];
      if (!existing) return state;
      return {
        cascades: {
          ...state.cascades,
          [nodeId]: { ...existing, status: 'failed', errorNodeName },
        },
      };
    }),
  clearCascade: (nodeId) =>
    set((state) => {
      const { [nodeId]: _, ...rest } = state.cascades;
      return { cascades: rest };
    }),
}));

export const useCascadeForNode = (nodeId: string) =>
  useCascadeStore((state) => state.cascades[nodeId]);
