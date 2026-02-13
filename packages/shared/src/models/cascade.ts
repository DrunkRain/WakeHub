export type CascadeType = 'start' | 'stop';

export type CascadeStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Cascade {
  id: string;
  nodeId: string;
  type: CascadeType;
  status: CascadeStatus;
  currentStep: number;
  totalSteps: number;
  failedStep: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}
