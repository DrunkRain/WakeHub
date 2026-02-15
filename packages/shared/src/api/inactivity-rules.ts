import type { InactivityRule, MonitoringCriteria } from '../models/inactivity-rule.js';

export interface InactivityRuleResponse {
  rule: InactivityRule;
}

export interface InactivityRuleListResponse {
  rules: InactivityRule[];
}

export interface CreateInactivityRuleRequest {
  nodeId: string;
  timeoutMinutes?: number;
  monitoringCriteria?: MonitoringCriteria;
  isEnabled?: boolean;
}

export interface UpdateInactivityRuleRequest {
  timeoutMinutes?: number;
  monitoringCriteria?: MonitoringCriteria;
  isEnabled?: boolean;
}
