import { Agent, request } from 'undici';

const DOCKER_TIMEOUT_MS = 15_000;
const DOCKER_API_VERSION = 'v1.45';

export interface DockerClientConfig {
  host: string;
  port: number;
  tlsEnabled?: boolean;
}

export class DockerClient {
  private readonly baseUrl: string;
  private readonly agent: Agent;

  constructor(config: DockerClientConfig) {
    const protocol = config.tlsEnabled ? 'https' : 'http';
    this.baseUrl = `${protocol}://${config.host}:${config.port}/${DOCKER_API_VERSION}`;
    this.agent = new Agent({ connect: { timeout: DOCKER_TIMEOUT_MS } });
  }

  async ping(): Promise<boolean> {
    const { statusCode, body } = await request(`${this.baseUrl}/_ping`, {
      method: 'GET',
      dispatcher: this.agent,
      headersTimeout: DOCKER_TIMEOUT_MS,
      bodyTimeout: DOCKER_TIMEOUT_MS,
    });
    await body.text();
    return statusCode === 200;
  }

  async get<T>(path: string): Promise<T> {
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'GET',
      dispatcher: this.agent,
      headersTimeout: DOCKER_TIMEOUT_MS,
      bodyTimeout: DOCKER_TIMEOUT_MS,
    });
    const json = (await body.json()) as T;
    if (statusCode !== 200) {
      throw new Error(`Docker GET ${path} failed (${statusCode})`);
    }
    return json;
  }

  async post(path: string): Promise<void> {
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'POST',
      dispatcher: this.agent,
      headersTimeout: DOCKER_TIMEOUT_MS,
      bodyTimeout: DOCKER_TIMEOUT_MS,
    });
    await body.text();
    if (statusCode !== 204 && statusCode !== 304) {
      throw new Error(`Docker POST ${path} failed (${statusCode})`);
    }
  }
}
