import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEManager } from './sse-manager.js';

function createMockReply() {
  const writeFn = vi.fn();
  const onFn = vi.fn();
  const endFn = vi.fn();
  return {
    raw: {
      write: writeFn,
      on: onFn,
      end: endFn,
    },
    _write: writeFn,
    _on: onFn,
    _end: endFn,
  } as unknown as ReturnType<typeof createMockReply> & { raw: { write: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }; _write: ReturnType<typeof vi.fn>; _on: ReturnType<typeof vi.fn>; _end: ReturnType<typeof vi.fn> };
}

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SSEManager();
  });

  afterEach(() => {
    manager.close();
    vi.useRealTimers();
  });

  it('addClient increments client count', () => {
    const reply = createMockReply();
    manager.addClient('c1', reply as any);
    expect(manager.getClientCount()).toBe(1);
  });

  it('removeClient decrements client count', () => {
    const reply = createMockReply();
    manager.addClient('c1', reply as any);
    manager.removeClient('c1');
    expect(manager.getClientCount()).toBe(0);
  });

  it('removeClient is safe for unknown ids', () => {
    manager.removeClient('nonexistent');
    expect(manager.getClientCount()).toBe(0);
  });

  it('broadcast sends event to all clients', () => {
    const reply1 = createMockReply();
    const reply2 = createMockReply();
    manager.addClient('c1', reply1 as any);
    manager.addClient('c2', reply2 as any);

    manager.broadcast('test-event', { foo: 'bar' });

    expect(reply1.raw.write).toHaveBeenCalledTimes(1);
    expect(reply2.raw.write).toHaveBeenCalledTimes(1);

    const payload1 = reply1.raw.write.mock.calls[0]![0] as string;
    expect(payload1).toContain('event: test-event');
    expect(payload1).toContain('data: {"foo":"bar"}');
    expect(payload1).toMatch(/^id: \d+\n/);
    expect(payload1).toMatch(/\n\n$/);
  });

  it('broadcast with 0 clients does not throw', () => {
    expect(() => manager.broadcast('test', {})).not.toThrow();
  });

  it('send sends event to a specific client', () => {
    const reply1 = createMockReply();
    const reply2 = createMockReply();
    manager.addClient('c1', reply1 as any);
    manager.addClient('c2', reply2 as any);

    manager.send('c1', 'targeted', { x: 1 });

    expect(reply1.raw.write).toHaveBeenCalledTimes(1);
    expect(reply2.raw.write).not.toHaveBeenCalled();
  });

  it('send to unknown client does not throw', () => {
    expect(() => manager.send('nonexistent', 'evt', {})).not.toThrow();
  });

  it('heartbeat is sent every 30 seconds', () => {
    const reply = createMockReply();
    manager.addClient('c1', reply as any);

    // Advance by 30 seconds
    vi.advanceTimersByTime(30_000);
    expect(reply.raw.write).toHaveBeenCalledTimes(1);
    expect(reply.raw.write).toHaveBeenCalledWith(': heartbeat\n\n');

    // Advance by another 30 seconds
    vi.advanceTimersByTime(30_000);
    expect(reply.raw.write).toHaveBeenCalledTimes(2);
  });

  it('close cleans up all clients and intervals', () => {
    const reply1 = createMockReply();
    const reply2 = createMockReply();
    manager.addClient('c1', reply1 as any);
    manager.addClient('c2', reply2 as any);

    manager.close();

    expect(manager.getClientCount()).toBe(0);

    // Heartbeats should no longer fire
    vi.advanceTimersByTime(60_000);
    expect(reply1.raw.write).not.toHaveBeenCalled();
    expect(reply2.raw.write).not.toHaveBeenCalled();
  });

  it('close calls reply.raw.end() on all clients', () => {
    const reply1 = createMockReply();
    const reply2 = createMockReply();
    manager.addClient('c1', reply1 as any);
    manager.addClient('c2', reply2 as any);

    manager.close();

    expect(reply1.raw.end).toHaveBeenCalledTimes(1);
    expect(reply2.raw.end).toHaveBeenCalledTimes(1);
  });

  it('SSE event format is correct', () => {
    const reply = createMockReply();
    manager.addClient('c1', reply as any);

    manager.broadcast('status-change', { serviceId: 'r1', status: 'online' });

    const payload = reply.raw.write.mock.calls[0]![0] as string;
    const lines = payload.split('\n');
    expect(lines[0]).toMatch(/^id: \d+$/);
    expect(lines[1]).toBe('event: status-change');
    expect(lines[2]).toBe('data: {"serviceId":"r1","status":"online"}');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('');
  });

  it('handles write errors gracefully during broadcast', () => {
    const reply = createMockReply();
    reply.raw.write.mockImplementation(() => { throw new Error('broken pipe'); });
    manager.addClient('c1', reply as any);

    expect(() => manager.broadcast('test', {})).not.toThrow();
  });

  it('registers close handler on reply.raw', () => {
    const reply = createMockReply();
    manager.addClient('c1', reply as any);

    expect(reply.raw.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('close handler removes client when triggered', () => {
    const reply = createMockReply();
    manager.addClient('c1', reply as any);

    // Get the close handler and call it
    const closeHandler = reply.raw.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'close',
    )?.[1] as () => void;
    expect(closeHandler).toBeDefined();

    closeHandler();
    expect(manager.getClientCount()).toBe(0);
  });
});
