import { Agent, request } from 'undici';

const PROXMOX_TIMEOUT_MS = 30_000;
const PROXMOX_DEFAULT_PORT = 8006;

export interface ProxmoxClientConfig {
  host: string;
  port?: number;
  verifySsl?: boolean;
  authType: 'token' | 'password';
  tokenId?: string;
  tokenSecret?: string;
  username?: string;
  password?: string;
}

interface TicketData {
  ticket: string;
  CSRFPreventionToken: string;
}

export class ProxmoxClient {
  private readonly baseUrl: string;
  private readonly agent: Agent;
  private readonly config: ProxmoxClientConfig;

  // Token auth headers (set at construction for token auth)
  private tokenHeaders: Record<string, string> | null = null;

  // Ticket auth state (lazy-initialized on first request for password auth)
  private ticketData: TicketData | null = null;

  constructor(config: ProxmoxClientConfig) {
    const port = config.port ?? PROXMOX_DEFAULT_PORT;
    this.baseUrl = `https://${config.host}:${port}/api2/json`;
    this.agent = new Agent({ connect: { rejectUnauthorized: config.verifySsl ?? false } });
    this.config = config;

    if (config.authType === 'token') {
      this.tokenHeaders = {
        Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`,
      };
    }
  }

  async get<T>(path: string): Promise<T> {
    const headers = await this.getHeaders('GET');
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
      dispatcher: this.agent,
      headersTimeout: PROXMOX_TIMEOUT_MS,
      bodyTimeout: PROXMOX_TIMEOUT_MS,
    });
    const json = (await body.json()) as { data: T };
    if (statusCode !== 200) {
      throw new Error(`Proxmox GET ${path} failed (${statusCode})`);
    }
    return json.data;
  }

  async post<T>(path: string, params?: Record<string, string>): Promise<T> {
    const headers = await this.getHeaders('POST');
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params ? new URLSearchParams(params).toString() : undefined,
      dispatcher: this.agent,
      headersTimeout: PROXMOX_TIMEOUT_MS,
      bodyTimeout: PROXMOX_TIMEOUT_MS,
    });
    const json = (await body.json()) as { data: T };
    if (statusCode !== 200) {
      throw new Error(`Proxmox POST ${path} failed (${statusCode})`);
    }
    return json.data;
  }

  destroy(): void {
    this.agent.close();
  }

  private async getHeaders(method: 'GET' | 'POST'): Promise<Record<string, string>> {
    if (this.tokenHeaders) {
      return this.tokenHeaders;
    }

    // Password/ticket auth — obtain ticket if not yet acquired
    if (!this.ticketData) {
      this.ticketData = await this.obtainTicket();
    }

    const headers: Record<string, string> = {
      Cookie: `PVEAuthCookie=${this.ticketData.ticket}`,
    };

    // POST requests need CSRF prevention token
    if (method === 'POST') {
      headers.CSRFPreventionToken = this.ticketData.CSRFPreventionToken;
    }

    return headers;
  }

  private async obtainTicket(): Promise<TicketData> {
    const { statusCode, body } = await request(`${this.baseUrl}/access/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: this.config.username!,
        password: this.config.password!,
      }).toString(),
      dispatcher: this.agent,
      headersTimeout: PROXMOX_TIMEOUT_MS,
      bodyTimeout: PROXMOX_TIMEOUT_MS,
    });

    const json = (await body.json()) as { data: TicketData };
    if (statusCode !== 200) {
      throw new Error(`Proxmox authentication failed (${statusCode})`);
    }

    return json.data;
  }
}
