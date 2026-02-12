import { describe, it, expect } from 'vitest';
import { getConnector } from './connector-factory.js';
import { WolSshConnector } from './wol-ssh.connector.js';

describe('ConnectorFactory', () => {
  it('should return WolSshConnector for physical nodes', () => {
    const connector = getConnector('physical');
    expect(connector).toBeInstanceOf(WolSshConnector);
  });

  it('should throw for vm node type (not yet implemented)', () => {
    expect(() => getConnector('vm')).toThrow('No connector available for node type: vm');
  });

  it('should throw for lxc node type (not yet implemented)', () => {
    expect(() => getConnector('lxc')).toThrow('No connector available for node type: lxc');
  });

  it('should throw for container node type (not yet implemented)', () => {
    expect(() => getConnector('container')).toThrow('No connector available for node type: container');
  });

  it('should return the same instance for multiple calls', () => {
    const connector1 = getConnector('physical');
    const connector2 = getConnector('physical');
    expect(connector1).toBe(connector2);
  });
});
