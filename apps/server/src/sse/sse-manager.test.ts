import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import type { ServerResponse } from 'node:http';
import { SSEManager } from './sse-manager.js';

function createMockResponse(): ServerResponse & { getOutput: () => string } {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  return Object.assign(stream, {
    writeHead: vi.fn(),
    destroyed: false,
    getOutput: () => output,
  }) as unknown as ServerResponse & { getOutput: () => string };
}

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SSEManager(5, 30_000); // small buffer for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Client management ---

  describe('Client management', () => {
    it('should add a client and increment count', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);
      expect(manager.getClientCount()).toBe(1);
    });

    it('should remove a client and decrement count', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);
      manager.removeClient('c1');
      expect(manager.getClientCount()).toBe(0);
    });

    it('should not error when removing a non-existent client', () => {
      expect(() => manager.removeClient('non-existent')).not.toThrow();
    });

    it('should return correct client count with multiple clients', () => {
      manager.addClient('c1', createMockResponse());
      manager.addClient('c2', createMockResponse());
      manager.addClient('c3', createMockResponse());
      expect(manager.getClientCount()).toBe(3);
    });
  });

  // --- Broadcast ---

  describe('Broadcast', () => {
    it('should send event to a single client in SSE format', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);

      manager.broadcast('status-change', { nodeId: 'n1', status: 'online' });

      const output = res.getOutput();
      expect(output).toContain('id: 1\n');
      expect(output).toContain('event: status-change\n');
      expect(output).toContain('data: {"nodeId":"n1","status":"online"}\n');
      expect(output).toMatch(/\n\n$/);
    });

    it('should send event to multiple clients', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      manager.addClient('c1', res1);
      manager.addClient('c2', res2);

      manager.broadcast('test', { value: 42 });

      expect(res1.getOutput()).toContain('event: test\n');
      expect(res2.getOutput()).toContain('event: test\n');
    });

    it('should not error when broadcasting with no clients', () => {
      expect(() => manager.broadcast('test', { value: 1 })).not.toThrow();
    });

    it('should produce correct SSE format with id, event, data', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);

      manager.broadcast('cascade-progress', { cascadeId: 'abc', step: 1 });

      const output = res.getOutput();
      const lines = output.split('\n');
      expect(lines[0]).toBe('id: 1');
      expect(lines[1]).toBe('event: cascade-progress');
      expect(lines[2]).toBe('data: {"cascadeId":"abc","step":1}');
      expect(lines[3]).toBe('');
      expect(lines[4]).toBe('');
    });

    it('should increment event IDs for each broadcast', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);

      manager.broadcast('a', {});
      manager.broadcast('b', {});
      manager.broadcast('c', {});

      const output = res.getOutput();
      expect(output).toContain('id: 1\n');
      expect(output).toContain('id: 2\n');
      expect(output).toContain('id: 3\n');
    });

    it('should skip destroyed responses', () => {
      const res = createMockResponse();
      (res as any).destroyed = true;
      manager.addClient('c1', res);

      // Should not throw even though the response is destroyed
      expect(() => manager.broadcast('test', {})).not.toThrow();
    });
  });

  // --- Buffer and reconnection ---

  describe('Buffer and reconnection', () => {
    it('should store events in the buffer', () => {
      manager.broadcast('a', { v: 1 });
      manager.broadcast('b', { v: 2 });

      const res = createMockResponse();
      manager.replayEvents(0, res);

      const output = res.getOutput();
      expect(output).toContain('event: a\n');
      expect(output).toContain('event: b\n');
    });

    it('should replay only events after lastEventId', () => {
      manager.broadcast('a', { v: 1 }); // id: 1
      manager.broadcast('b', { v: 2 }); // id: 2
      manager.broadcast('c', { v: 3 }); // id: 3

      const res = createMockResponse();
      manager.replayEvents(2, res);

      const output = res.getOutput();
      expect(output).not.toContain('event: a\n');
      expect(output).not.toContain('event: b\n');
      expect(output).toContain('event: c\n');
    });

    it('should not exceed the buffer size (circular)', () => {
      // Buffer size is 5
      for (let i = 0; i < 8; i++) {
        manager.broadcast('evt', { i });
      }

      const res = createMockResponse();
      manager.replayEvents(0, res);

      const output = res.getOutput();
      // Only the last 5 events should be in the buffer (ids 4-8)
      expect(output).not.toContain('id: 1\n');
      expect(output).not.toContain('id: 2\n');
      expect(output).not.toContain('id: 3\n');
      expect(output).toContain('id: 4\n');
      expect(output).toContain('id: 8\n');
    });

    it('should not error when replaying with an old ID no longer in buffer', () => {
      for (let i = 0; i < 10; i++) {
        manager.broadcast('evt', { i });
      }

      const res = createMockResponse();
      // lastEventId=1 is no longer in the buffer (size 5, so only 6-10 remain)
      expect(() => manager.replayEvents(1, res)).not.toThrow();

      // Should replay events that are in the buffer (6-10)
      const output = res.getOutput();
      expect(output).toContain('id: 6\n');
    });
  });

  // --- Heartbeat ---

  describe('Heartbeat', () => {
    it('should send heartbeat comment at interval', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);

      vi.advanceTimersByTime(30_000);

      const output = res.getOutput();
      expect(output).toContain(': heartbeat\n\n');
    });

    it('should clear heartbeat on client removal', () => {
      const res = createMockResponse();
      manager.addClient('c1', res);
      manager.removeClient('c1');

      vi.advanceTimersByTime(60_000);

      // No heartbeat should have been sent after removal
      const output = res.getOutput();
      expect(output).not.toContain(': heartbeat');
    });
  });
});
