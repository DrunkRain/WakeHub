import type { DependencyLink, DependencyNodeInfo } from '../models/dependency.js';

export interface CreateDependencyResponse {
  dependency: DependencyLink;
}

export interface DependenciesQueryResponse {
  upstream: DependencyNodeInfo[];
  downstream: DependencyNodeInfo[];
}

export interface DeleteDependencyResponse {
  success: boolean;
}

export interface DependencyGraphNode {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface DependencyGraphLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface DependencyGraphResponse {
  nodes: DependencyGraphNode[];
  links: DependencyGraphLink[];
}
