export class PlatformError extends Error {
  constructor(
    public code: string,
    message: string,
    public platform: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}
