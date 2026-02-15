import type { ServerResponse } from 'node:http';

interface SSEClient {
  id: string;
  response: ServerResponse;
  heartbeatTimer: NodeJS.Timeout;
}

interface BufferedEvent {
  id: number;
  event: string;
  data: string;
}

export class SSEManager {
  private clients = new Map<string, SSEClient>();
  private eventBuffer: BufferedEvent[] = [];
  private nextEventId = 1;
  private readonly bufferSize: number;
  private readonly heartbeatIntervalMs: number;

  constructor(bufferSize = 100, heartbeatIntervalMs = 30_000) {
    this.bufferSize = bufferSize;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  addClient(id: string, response: ServerResponse): void {
    const heartbeatTimer = setInterval(() => {
      if (!response.destroyed) {
        response.write(': heartbeat\n\n');
      }
    }, this.heartbeatIntervalMs);

    this.clients.set(id, { id, response, heartbeatTimer });
  }

  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      clearInterval(client.heartbeatTimer);
      this.clients.delete(id);
    }
  }

  broadcast(event: string, data: unknown): void {
    const eventId = this.nextEventId++;
    const jsonData = JSON.stringify(data);

    // Buffer the event for reconnection replay
    this.eventBuffer.push({ id: eventId, event, data: jsonData });
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }

    const message = `id: ${eventId}\nevent: ${event}\ndata: ${jsonData}\n\n`;

    for (const client of this.clients.values()) {
      if (!client.response.destroyed) {
        client.response.write(message);
      }
    }
  }

  replayEvents(lastEventId: number, response: ServerResponse): void {
    for (const buffered of this.eventBuffer) {
      if (buffered.id > lastEventId) {
        response.write(`id: ${buffered.id}\nevent: ${buffered.event}\ndata: ${buffered.data}\n\n`);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
