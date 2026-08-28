export class NotImplementedCapabilityError extends Error {
  constructor(capability: string) {
    super(`${capability} is scaffolded but not implemented yet.`);
    this.name = 'NotImplementedCapabilityError';
  }
}

export function notImplementedResult(capability: string, details?: Record<string, unknown>) {
  return {
    status: 'not_implemented',
    capability,
    message: `${capability} interface is ready, but the implementation has not been provided yet.`,
    details: details ?? {},
  };
}
