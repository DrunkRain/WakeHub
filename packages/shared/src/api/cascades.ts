import type { Cascade } from '../models/cascade.js';

export interface StartCascadeRequest {
  nodeId: string;
}

export interface StopCascadeRequest {
  nodeId: string;
}

export interface CascadeResponse {
  cascade: Pick<Cascade, 'id' | 'nodeId' | 'type' | 'status'>;
}

export interface CascadeDetailResponse {
  cascade: Cascade;
}
