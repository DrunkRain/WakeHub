import { Client } from 'ssh2';
import wol from 'wake_on_lan';
import type { PlatformConnector } from './connector.interface.js';
import { PlatformError } from '../utils/platform-error.js';

const SSH_READY_TIMEOUT_MS = 10_000;
const SSH_STATUS_TIMEOUT_MS = 5_000;
const WOL_BROADCAST_ADDRESS = '255.255.255.255';

interface WolSshConfig {
  host: string;
  macAddress?: string;
  sshUser: string;
  sshPassword: string;
}

export class WolSshConnector implements PlatformConnector {
  constructor(private readonly config: WolSshConfig) {}

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve({ success: false, message: 'Connexion SSH timeout après 10s' });
      }, SSH_READY_TIMEOUT_MS);

      conn.on('ready', () => {
        clearTimeout(timeout);
        conn.end();
        resolve({ success: true, message: 'Connexion SSH réussie' });
      });

      conn.on('error', (err: Error) => {
        clearTimeout(timeout);
        resolve({ success: false, message: `Connexion SSH échouée : ${err.message}` });
      });

      conn.connect({
        host: this.config.host,
        port: 22,
        username: this.config.sshUser,
        password: this.config.sshPassword,
        readyTimeout: SSH_READY_TIMEOUT_MS,
      });
    });
  }

  async start(): Promise<void> {
    if (!this.config.macAddress) {
      throw new PlatformError('NO_START_CAPABILITY', 'Démarrage impossible — adresse MAC non configurée', 'wol-ssh');
    }
    return new Promise((resolve, reject) => {
      wol.wake(
        this.config.macAddress!,
        { address: WOL_BROADCAST_ADDRESS },
        (error: Error | undefined) => {
          if (error) {
            reject(
              new PlatformError(
                'WOL_SEND_FAILED',
                `Échec envoi magic packet : ${error.message}`,
                'wol-ssh',
                { macAddress: this.config.macAddress },
              ),
            );
          } else {
            resolve();
          }
        },
      );
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        conn.exec('sudo shutdown -h now', (err) => {
          if (err) {
            conn.destroy();
            reject(
              new PlatformError(
                'SSH_COMMAND_FAILED',
                `Échec commande shutdown : ${err.message}`,
                'wol-ssh',
                { host: this.config.host },
              ),
            );
            return;
          }
          // Connection will close during shutdown — that's expected
          conn.on('close', () => resolve());
          conn.on('error', () => resolve());
          // Resolve after a short delay if connection doesn't close
          setTimeout(() => {
            conn.destroy();
            resolve();
          }, 3000);
        });
      });

      conn.on('error', (err: Error) => {
        reject(
          new PlatformError(
            'SSH_CONNECTION_FAILED',
            `Connexion SSH échouée pour arrêt : ${err.message}`,
            'wol-ssh',
            { host: this.config.host },
          ),
        );
      });

      conn.connect({
        host: this.config.host,
        port: 22,
        username: this.config.sshUser,
        password: this.config.sshPassword,
        readyTimeout: SSH_READY_TIMEOUT_MS,
      });
    });
  }

  async getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'> {
    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve('offline');
      }, SSH_STATUS_TIMEOUT_MS);

      conn.on('ready', () => {
        clearTimeout(timeout);
        conn.end();
        resolve('online');
      });

      conn.on('error', () => {
        clearTimeout(timeout);
        resolve('offline');
      });

      conn.connect({
        host: this.config.host,
        port: 22,
        username: this.config.sshUser,
        password: this.config.sshPassword,
        readyTimeout: SSH_STATUS_TIMEOUT_MS,
      });
    });
  }
}
