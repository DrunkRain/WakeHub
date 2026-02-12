import { describe, it, expect } from 'vitest';
import { PlatformError } from './platform-error.js';

describe('PlatformError', () => {
  it('should be an instance of Error', () => {
    const error = new PlatformError('SSH_CONNECTION_FAILED', 'Connection refused', 'wol-ssh');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have the correct name', () => {
    const error = new PlatformError('SSH_CONNECTION_FAILED', 'Connection refused', 'wol-ssh');
    expect(error.name).toBe('PlatformError');
  });

  it('should store code, message, and platform', () => {
    const error = new PlatformError('WOL_SEND_FAILED', 'Cannot send packet', 'wol-ssh');
    expect(error.code).toBe('WOL_SEND_FAILED');
    expect(error.message).toBe('Cannot send packet');
    expect(error.platform).toBe('wol-ssh');
  });

  it('should store optional details', () => {
    const details = { host: '192.168.1.10', port: 22 };
    const error = new PlatformError('SSH_CONNECTION_FAILED', 'Timeout', 'wol-ssh', details);
    expect(error.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const error = new PlatformError('NODE_UNREACHABLE', 'Host down', 'wol-ssh');
    expect(error.details).toBeUndefined();
  });
});
