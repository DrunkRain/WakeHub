export class PlatformError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly platform: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}
