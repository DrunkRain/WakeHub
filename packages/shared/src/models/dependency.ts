export interface DependencyLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  createdAt: Date;
}

export interface CreateDependencyRequest {
  fromNodeId: string;
  toNodeId: string;
}

export interface DependencyNodeInfo {
  linkId: string;
  nodeId: string;
  name: string;
  type: string;
  status: string;
}

export interface DependencyChain {
  upstream: DependencyNodeInfo[];
  downstream: DependencyNodeInfo[];
}
