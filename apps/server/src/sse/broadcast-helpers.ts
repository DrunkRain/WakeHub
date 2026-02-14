import type { CascadeProgressEvent } from '../services/cascade-engine.js';

export function broadcastCascadeEvent(
  sseManager: { broadcast(event: string, data: unknown): void },
  event: CascadeProgressEvent,
): void {
  switch (event.type) {
    case 'cascade-started':
      sseManager.broadcast('cascade-progress', {
        cascadeId: event.cascadeId,
        nodeId: event.nodeId,
        step: 0,
        totalSteps: event.totalSteps,
        status: 'started',
      });
      break;
    case 'step-progress':
      sseManager.broadcast('cascade-progress', {
        cascadeId: event.cascadeId,
        nodeId: event.nodeId,
        step: event.stepIndex,
        totalSteps: event.totalSteps,
        currentNodeId: event.currentNodeId,
        currentNodeName: event.currentNodeName,
      });
      break;
    case 'node-status-change':
      sseManager.broadcast('status-change', {
        nodeId: event.nodeId,
        status: event.status,
        timestamp: new Date().toISOString(),
      });
      break;
    case 'cascade-complete':
      if (event.success) {
        sseManager.broadcast('cascade-complete', {
          cascadeId: event.cascadeId,
          nodeId: event.nodeId,
          success: true,
        });
      } else {
        sseManager.broadcast('cascade-error', {
          cascadeId: event.cascadeId,
          nodeId: event.nodeId,
          error: event.error,
        });
      }
      break;
  }
}
