import type { FastifyReply } from 'fastify';

interface SSEClient {
  id: string;
  reply: FastifyReply;
  heartbeatInterval: ReturnType<typeof setInterval>;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private eventCounter = 0;

  /**
   * Add a new SSE client. Sets up heartbeat and close handler.
   */
  addClient(id: string, reply: FastifyReply): void {
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        this.removeClient(id);
      }
    }, HEARTBEAT_INTERVAL_MS);

    this.clients.set(id, { id, reply, heartbeatInterval });

    reply.raw.on('close', () => {
      this.removeClient(id);
    });
  }

  /**
   * Remove a client and clean up its heartbeat interval.
   */
  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      clearInterval(client.heartbeatInterval);
      this.clients.delete(id);
    }
  }

  /**
   * Broadcast an event to all connected clients.
   */
  broadcast(event: string, data: unknown): void {
    const eventId = ++this.eventCounter;
    for (const client of this.clients.values()) {
      this.writeEvent(client.reply, event, data, eventId);
    }
  }

  /**
   * Send an event to a specific client.
   */
  send(clientId: string, event: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.writeEvent(client.reply, event, data, ++this.eventCounter);
    }
  }

  /**
   * Get the number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all client connections and clean up.
   */
  close(): void {
    for (const client of this.clients.values()) {
      clearInterval(client.heartbeatInterval);
      try {
        client.reply.raw.end();
      } catch {
        // Client may already be disconnected
      }
    }
    this.clients.clear();
  }

  private writeEvent(reply: FastifyReply, event: string, data: unknown, id: number): void {
    try {
      const payload = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      reply.raw.write(payload);
    } catch {
      // Client disconnected — will be cleaned up by close handler
    }
  }
}
