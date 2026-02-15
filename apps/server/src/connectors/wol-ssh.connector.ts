import { NodeSSH } from 'node-ssh';
import wol from 'wake_on_lan';
import type { Node, NodeStatus } from '@wakehub/shared';
import type { PlatformConnector } from './connector.interface.js';
import { PlatformError } from '../utils/platform-error.js';
import net from 'node:net';

const SSH_TIMEOUT_MS = 10_000;
const STATUS_TIMEOUT_MS = 5_000;
const PLATFORM = 'wol-ssh';

function sendWol(macAddress: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wol.wake(macAddress, (error: Error | undefined) => {
      if (error) {
        reject(new PlatformError('WOL_SEND_FAILED', error.message, PLATFORM, { macAddress }));
      } else {
        resolve();
      }
    });
  });
}

function checkTcpPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export class WolSshConnector implements PlatformConnector {
  async testConnection(node: Node): Promise<boolean> {
    if (!node.ipAddress || !node.sshUser) {
      throw new PlatformError(
        'SSH_CONNECTION_FAILED',
        'Missing IP address or SSH user',
        PLATFORM,
        { ipAddress: node.ipAddress, sshUser: node.sshUser },
      );
    }

    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: node.ipAddress,
        username: node.sshUser,
        password: node.sshCredentialsEncrypted ?? undefined,
        readyTimeout: SSH_TIMEOUT_MS,
      });
      ssh.dispose();
      return true;
    } catch (error) {
      throw new PlatformError(
        'SSH_CONNECTION_FAILED',
        (error as Error).message,
        PLATFORM,
        { host: node.ipAddress },
      );
    }
  }

  async start(node: Node): Promise<void> {
    if (!node.macAddress) {
      throw new PlatformError(
        'WOL_SEND_FAILED',
        'Missing MAC address',
        PLATFORM,
        { nodeId: node.id },
      );
    }

    await sendWol(node.macAddress);
  }

  async stop(node: Node): Promise<void> {
    if (!node.ipAddress || !node.sshUser) {
      throw new PlatformError(
        'SSH_CONNECTION_FAILED',
        'Missing IP address or SSH user',
        PLATFORM,
        { ipAddress: node.ipAddress, sshUser: node.sshUser },
      );
    }

    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: node.ipAddress,
        username: node.sshUser,
        password: node.sshCredentialsEncrypted ?? undefined,
        readyTimeout: SSH_TIMEOUT_MS,
      });
      await ssh.execCommand('sudo shutdown -h now');
      ssh.dispose();
    } catch (error) {
      throw new PlatformError(
        'SSH_COMMAND_FAILED',
        (error as Error).message,
        PLATFORM,
        { host: node.ipAddress, command: 'sudo shutdown -h now' },
      );
    }
  }

  async getStatus(node: Node): Promise<NodeStatus> {
    if (!node.ipAddress) {
      return 'error';
    }

    const reachable = await checkTcpPort(node.ipAddress, 22, STATUS_TIMEOUT_MS);
    return reachable ? 'online' : 'offline';
  }
}
